"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AssetActions({
  assetId,
  currentAssignmentId,
  status,
}: {
  assetId: string;
  currentAssignmentId: string | null;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function returnAsset() {
    setBusy(true);
    await fetch(`/api/assets/${assetId}/return`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ condition_at_return: "good", return_reason: "reassigned" }),
    });
    setBusy(false);
    router.refresh();
  }

  async function reportDamaged() {
    const reason = prompt("Describe the damage:");
    if (!reason) return;
    setBusy(true);
    await fetch("/api/damaged-scrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asset_id: assetId, reason }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      {currentAssignmentId ? (
        <button className="btn-secondary" disabled={busy} onClick={returnAsset}>
          Return asset
        </button>
      ) : null}
      {status !== "scrapped" && (
        <button className="btn-secondary" disabled={busy} onClick={reportDamaged}>
          Report damaged
        </button>
      )}
    </div>
  );
}
