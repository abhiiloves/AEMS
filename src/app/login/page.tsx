"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Two-step OTP login, calling the request-otp / verify-otp routes
// built earlier. No password field anywhere (per the reverted-to-OTP
// decision). Kept as one page/one component rather than a wizard
// library — the flow is only two steps and doesn't need one.
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
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-sm font-semibold text-white">
            PG
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide text-white">A.E.M.S</p>
            <p className="text-xs text-white/50">Asset Entry Management System</p>
          </div>
        </div>

        <div className="card p-6">
          {step === "email" ? (
            <form onSubmit={requestOtp}>
              <h1 className="mb-1 text-lg font-semibold text-ink-900">Sign in</h1>
              <p className="mb-5 text-sm text-ink-600">We&apos;ll email you a one-time code.</p>
              <label className="label" htmlFor="email">
                Work email
              </label>
              <input
                id="email"
                type="email"
                required
                autoFocus
                className="input"
                placeholder="you@pgel.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {error && <p className="mt-3 text-sm text-danger">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary mt-5 w-full">
                {loading ? "Sending…" : "Send code"}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyOtp}>
              <h1 className="mb-1 text-lg font-semibold text-ink-900">Enter the code</h1>
              <p className="mb-5 text-sm text-ink-600">Sent to {email}</p>
              <label className="label" htmlFor="code">
                6-digit code
              </label>
              <input
                id="code"
                inputMode="numeric"
                maxLength={6}
                required
                autoFocus
                className="input text-center text-lg tracking-[0.4em]"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
              {error && <p className="mt-3 text-sm text-danger">{error}</p>}
              <button type="submit" disabled={loading || code.length !== 6} className="btn-primary mt-5 w-full">
                {loading ? "Verifying…" : "Verify & sign in"}
              </button>
              <button
                type="button"
                disabled={resendIn > 0}
                onClick={requestOtp as unknown as () => void}
                className="mt-3 w-full text-center text-sm text-ink-600 hover:text-accent disabled:text-ink-400"
              >
                {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
