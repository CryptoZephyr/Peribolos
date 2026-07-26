"use client";

import { useEffect, useState, useMemo } from "react";
import { fetchApi, API_BASE_URL } from "@/lib/api-client";
import { useToast } from "@/app/components/Toast";
import { SkeletonTableRows } from "@/app/components/Skeleton";
import { ExplorerBadge, CopyButton } from "@/app/components/ExplorerBadge";

export default function ActivityPage() {
  const [paymentRequests, setPaymentRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "EXECUTED" | "BLOCKED">("ALL");

  const toast = useToast();

  useEffect(() => {
    fetchApi("/v1/activity")
      .then((data: any) => {
        setPaymentRequests(data.paymentRequests || []);
      })
      .catch((err) => {
        console.warn("Failed to load activity:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  const { filteredRequests, executedCount, blockedCount } = useMemo(() => {
    let executed = 0;
    let blocked = 0;
    const filtered: any[] = [];

    for (let i = 0; i < paymentRequests.length; i++) {
      const pr = paymentRequests[i];
      if (pr.status === "EXECUTED") executed++;
      else if (pr.status === "BLOCKED") blocked++;

      if (filter === "ALL") filtered.push(pr);
      else if (filter === "EXECUTED" && pr.status === "EXECUTED") filtered.push(pr);
      else if (filter === "BLOCKED" && pr.status === "BLOCKED") filtered.push(pr);
    }

    return { filteredRequests: filtered, executedCount: executed, blockedCount: blocked };
  }, [paymentRequests, filter]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Activity & Audit Log</h1>
          <p className="text-sm text-text-muted mt-1">
            Normalized ledger of every payment executed or blocked by Peribolos contract rules on Arc.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`${API_BASE_URL}/v1/audit/export?format=csv`}
            download="peribolos-audit-log.csv"
            onClick={() => toast.info("Downloading Audit Log", "CSV export requested.")}
            className="rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white hover:opacity-90 shadow-sm transition-all"
          >
            📥 Export Audit Log (CSV)
          </a>
          <a
            href={`${API_BASE_URL}/v1/audit/export?format=json`}
            download="peribolos-audit-log.json"
            onClick={() => toast.info("Downloading Audit Log", "JSON export requested.")}
            className="rounded-md border border-line bg-surface-raised px-4 py-2 text-xs font-semibold text-text hover:bg-surface-raised/80 transition-colors"
          >
            JSON Export
          </a>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter("ALL")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            filter === "ALL"
              ? "bg-accent text-white"
              : "bg-surface-raised border border-line text-text-muted hover:text-text"
          }`}
        >
          All Activity ({paymentRequests.length})
        </button>
        <button
          onClick={() => setFilter("EXECUTED")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            filter === "EXECUTED"
              ? "bg-emerald-600 text-white"
              : "bg-surface-raised border border-line text-text-muted hover:text-text"
          }`}
        >
          Executed ({executedCount})
        </button>
        <button
          onClick={() => setFilter("BLOCKED")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            filter === "BLOCKED"
              ? "bg-rose-600 text-white"
              : "bg-surface-raised border border-line text-text-muted hover:text-text"
          }`}
        >
          Blocked Attempts ({blockedCount})
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-line bg-surface-raised p-6">
          <SkeletonTableRows rows={5} />
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="py-16 text-center text-xs text-text-muted border border-dashed border-line rounded-xl bg-surface-raised">
          No records matching selected filter.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface-raised shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line bg-surface/50 text-text-muted uppercase text-[10px]">
              <tr>
                <th className="px-4 py-3 font-semibold">Timestamp</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Payee</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Reason / Details</th>
                <th className="px-4 py-3 font-semibold text-right">Arcscan Proof</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredRequests.map((pr) => (
                <tr key={pr.id} className="hover:bg-surface/40 transition-colors">
                  <td className="px-4 py-3 text-text-muted whitespace-nowrap">
                    {new Date(pr.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                        pr.status === "EXECUTED"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : pr.status === "BLOCKED"
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                      }`}
                    >
                      {pr.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-text">
                    <div className="flex items-center gap-2">
                      <span>{pr.payeeName || "Payee"}</span>
                      {pr.payeeAddress && <CopyButton text={pr.payeeAddress} />}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-text whitespace-nowrap">
                    ${pr.amountUsdc.toFixed(2)} USDC
                  </td>
                  <td className="px-4 py-3 text-text-muted max-w-xs truncate">
                    {pr.blockReasonDescription ||
                      pr.blockReasonCode ||
                      "Executed within daily & per-tx limits"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {pr.txHash ? (
                      <ExplorerBadge type="tx" hashOrAddress={pr.txHash} />
                    ) : (
                      <span className="text-text-muted text-[10px] font-mono">Contract Rule</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
