"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

// Rebuilt to match the previous system's actual LoginScreen.tsx: white
// rounded card centered on a soft gray gradient, the real PG logo
// (public/pg-logo.png, copied from the old codebase), blue "Request
// OTP" step then an emerald "Verify & Login" step. Kept because the
// project asked specifically to reuse the old login's visual design
// rather than the navy-card version built earlier.
export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/request-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Could not send code");
      return;
    }
    setStep("code");
    setResendIn(60);
    const timer = setInterval(() => {
      setResendIn((s) => {
        if (s <= 1) {
          clearInterval(timer);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Incorrect code");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 p-4">
      <div className="w-full max-w-md">
        <div className="space-y-8 rounded-3xl border border-gray-200 bg-white p-8 shadow-2xl">
          <div className="space-y-4 text-center">
            <Image src="/pg-logo.png" alt="A.E.M.S Logo" width={176} height={128} className="mx-auto h-32 w-44 object-contain" priority />
            <h1 className="text-3xl font-black tracking-tight text-gray-800">A.E.M.S</h1>
          </div>

          {step === "email" ? (
            <form onSubmit={requestOtp} className="space-y-3">
              <label className="block text-xs font-medium uppercase tracking-widest text-gray-700">Registered Email</label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3.5 text-sm text-gray-800 placeholder-gray-400 transition-all focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="you@pgel.in"
              />
              {error && <p className="mt-2 text-center text-xs font-bold text-red-500">{error}</p>}
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full rounded-xl bg-blue-600 py-3.5 text-xs font-medium uppercase tracking-widest text-white shadow transition-all hover:-translate-y-0.5 hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Sending OTP…" : "Request OTP →"}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="space-y-3">
              <label className="block text-xs font-medium uppercase tracking-widest text-gray-700">Enter 6-Digit OTP</label>
              <input
                type="text"
                required
                autoFocus
                maxLength={6}
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3.5 text-center text-2xl font-black tracking-[0.5em] text-gray-800 placeholder-gray-500 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="000000"
              />
              {error && <p className="mt-2 text-center text-xs font-bold text-red-500">{error}</p>}
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full rounded-xl bg-emerald-600 py-3.5 text-xs font-medium uppercase tracking-widest text-white shadow transition-all hover:-translate-y-0.5 hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? "Verifying…" : "Verify & Login"}
              </button>
              <button
                type="button"
                disabled={resendIn > 0}
                onClick={requestOtp as unknown as () => void}
                className="mt-1 w-full text-center text-xs font-bold text-blue-600 transition-colors hover:text-blue-800 disabled:text-gray-400"
              >
                {resendIn > 0 ? `Resend code in ${resendIn}s` : "Back to Email / Resend"}
              </button>
            </form>
          )}
        </div>
        <p className="mt-6 text-center text-xs uppercase tracking-widest text-gray-500">
          © {new Date().getFullYear()} A.E.M.S — Secure Login
        </p>
      </div>
    </div>
  );
}
