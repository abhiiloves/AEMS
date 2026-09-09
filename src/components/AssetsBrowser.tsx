"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, QrCode, Pencil, Trash2 } from "lucide-react";

interface Asset {
  id: string;
  asset_code: string;
  brand: string | null;
  model: string | null;
  status: "available" | "assigned" | "maintenance" | "scrapped";
  category_id: string;
  serial_no: string | null;
}

const STATUS_STYLES: Record<Asset["status"], string> = {
  available: "bg-success-bg text-success",
  assigned: "bg-accent/10 text-accent",
  maintenance: "bg-attention-bg text-attention",
  scrapped: "bg-danger-bg text-danger",
};

export function AssetsBrowser({ categories }: { categories: { id: string; name: string }[] }) {
  const [query, setQuery] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handle = setTimeout(load, 300); // debounced search, per project decision
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, page]);

  async function load() {
    if (query.length > 0 && query.length < 2) return; // per project decision: min 2 chars
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (query) params.set("q", query);
    const res = await fetch(`/api/assets?${params}`);
    const data = await res.json();
    setAssets(data.data ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? "—";

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <input
          className="input max-w-sm"
          placeholder="Search asset code, serial, brand…"
          value={query}
          onChange={(e) => {
            setPage(1);
            setQuery(e.target.value);
          }}
        />
        <Link href="/assets/new" className="btn-primary shrink-0">
          <Plus size={16} /> New Asset
        </Link>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-ink-400">Loading…</p>
      ) : assets.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-400">No assets found.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => (
            <div key={asset.id} className="card p-4">
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <p className="font-mono text-sm font-semibold text-ink-900">{asset.asset_code}</p>
                  <p className="text-sm text-ink-600">
                    {asset.brand} {asset.model}
                  </p>
                </div>
                <span className={`badge ${STATUS_STYLES[asset.status]}`}>{asset.status}</span>
              </div>
              <p className="mb-3 text-xs text-ink-400">{categoryName(asset.category_id)}</p>
              <div className="flex items-center gap-3 border-t border-surface-border pt-3 text-ink-400">
                <button className="hover:text-accent" title="QR code">
                  <QrCode size={16} />
                </button>
                <Link href={`/assets/${asset.id}`} className="hover:text-accent" title="Edit">
                  <Pencil size={16} />
                </Link>
                <button className="hover:text-danger" title="Delete">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > 25 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button className="btn-secondary" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span className="text-sm text-ink-600">
            Page {page} of {Math.ceil(total / 25)}
          </span>
          <button className="btn-secondary" disabled={page >= Math.ceil(total / 25)} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}
