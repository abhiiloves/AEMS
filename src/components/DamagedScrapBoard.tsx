"use client";

import { useEffect, useState } from "react";

interface ScrapRecord {
  id: string;
  reason: string;
  status: "reported" | "under_review" | "approved" | "rejected" | "resolved";
  created_at: string;
  reviewed_at: string | null;
  resolution_notes: string | null;
  assets: { asset_code: string; brand: string; model: string } | null;
}

const STATUS_TABS = ["all", "reported", "under_review", "approved", "rejected", "resolved"] as const;

const STATUS_STYLES: Record<ScrapRecord["status"], string> = {
  reported: "bg-danger-bg text-danger",
  under_review: "bg-attention-bg text-attention",
  approved: "bg-ink-900/5 text-ink-600",
  rejected: "bg-success-bg text-success",
  resolved: "bg-success-bg text-success",
};

// Report vs review is split here the same way it's split at the API/
// RLS layer: canReview (admin/it_admin) controls whether the action
// buttons render at all, but the real gate is still server-side —
// this is UX convenience, not the security boundary.
export function DamagedScrapBoard({ canReview }: { canReview: boolean }) {
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]>("all");
  const [records, setRecords] = useState<ScrapRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function load() {
    setLoading(true);
    const params = tab === "all" ? "" : `?status=${tab}`;
    const res = await fetch(`/api/damaged-scrap${params}`);
    const data = await res.json();
    setRecords(data.data ?? []);
    setLoading(false);
  }

  async function updateStatus(id: string, status: ScrapRecord["status"]) {
    let resolution_notes: string | null = null;
    if (status === "rejected" || status === "resolved") {
      resolution_notes = prompt(`Notes for ${status}:`) ?? "";
    }
    await fetch(`/api/damaged-scrap/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, resolution_notes }),
    });
    load();
  }

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-ink-900">Damaged / Scrap</h1>
      <p className="mb-5 text-sm text-ink-600">Track and resolve damaged, scrapped, or under-repair assets.</p>

      <div className="mb-5 flex gap-1 overflow-x-auto">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
              tab === s ? "bg-navy-900 text-white" : "bg-white text-ink-600 hover:bg-surface-muted"
            }`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-ink-400">Loading…</p>
      ) : records.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-400">No reports found.</p>
      ) : (
        <div className="space-y-3">
          {records.map((r) => (
            <div key={r.id} className="card flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-semibold text-ink-900">
                  {r.assets?.brand} {r.assets?.model}{" "}
                  <span className="font-mono text-xs font-normal text-ink-400">{r.assets?.asset_code}</span>
                </p>
                <p className="mt-0.5 text-sm text-ink-600">{r.reason}</p>
                <p className="mt-1 text-xs text-ink-400">{new Date(r.created_at).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`badge ${STATUS_STYLES[r.status]}`}>{r.status.replace("_", " ")}</span>
                {canReview && r.status !== "resolved" && r.status !== "rejected" && (
                  <div className="flex gap-1.5">
                    {r.status === "reported" && (
                      <button className="btn-secondary !px-2.5 !py-1 text-xs" onClick={() => updateStatus(r.id, "under_review")}>
                        Review
                      </button>
                    )}
                    {r.status !== "approved" && (
                      <button className="btn-secondary !px-2.5 !py-1 text-xs" onClick={() => updateStatus(r.id, "approved")}>
                        Approve
                      </button>
                    )}
                    <button className="btn-secondary !px-2.5 !py-1 text-xs" onClick={() => updateStatus(r.id, "rejected")}>
                      Reject
                    </button>
                    {r.status === "approved" && (
                      <button className="btn-secondary !px-2.5 !py-1 text-xs" onClick={() => updateStatus(r.id, "resolved")}>
                        Resolve
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
