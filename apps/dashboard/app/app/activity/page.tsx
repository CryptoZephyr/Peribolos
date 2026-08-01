"use client";

import { useEffect, useState, useMemo } from "react";
import { fetchApi, API_BASE_URL } from "@/lib/api-client";
import { useToast } from "@/app/components/Toast";
import { SkeletonTableRows } from "@/app/components/Skeleton";
import { ExplorerBadge, CopyButton } from "@/app/components/ExplorerBadge";
import { DownloadSimple, MagnifyingGlass } from "@phosphor-icons/react";

export default function ActivityPage() {
  const [paymentRequests, setPaymentRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "EXECUTED" | "BLOCKED">("ALL");
  const [query, setQuery] = useState("");

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

      const matchesFilter = filter === "ALL" || (filter === "EXECUTED" && pr.status === "EXECUTED") || (filter === "BLOCKED" && pr.status === "BLOCKED");
      const haystack = `${pr.payeeName || ""} ${pr.payeeAddress || ""} ${pr.blockReasonCode || ""} ${pr.status || ""}`.toLowerCase();
      if (matchesFilter && haystack.includes(query.trim().toLowerCase())) filtered.push(pr);
    }

    return { filteredRequests: filtered, executedCount: executed, blockedCount: blocked };
  }, [paymentRequests, filter, query]);

  return (
    <div className="space-y-7 animate-in fade-in duration-300">
      <div className="flex flex-col gap-5 border-b border-line pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Payment history</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-text">Activity & audit</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-muted">
            Normalized ledger of every payment executed or blocked by Peribolos contract rules on Arc.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`${API_BASE_URL}/v1/audit/export?format=csv`}
            download="peribolos-audit-log.csv"
            onClick={() => toast.info("Downloading Audit Log", "CSV export requested.")}
            className="inline-flex items-center gap-2 rounded-lg bg-text px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-accent"
          >
            <DownloadSimple size={15} weight="bold" /> Export CSV
          </a>
          <a
            href={`${API_BASE_URL}/v1/audit/export?format=json`}
            download="peribolos-audit-log.json"
            onClick={() => toast.info("Downloading Audit Log", "JSON export requested.")}
            className="rounded-lg border border-line bg-surface-raised px-4 py-2.5 text-xs font-semibold text-text hover:border-line-strong hover:bg-surface"
          >
            JSON Export
          </a>
        </div>
      </div>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-raised p-1.5">
        <button
          onClick={() => setFilter("ALL")}
          className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
            filter === "ALL"
              ? "bg-accent text-white"
              : "text-text-muted hover:bg-surface hover:text-text"
          }`}
        >
          All Activity ({paymentRequests.length})
        </button>
        <button
          onClick={() => setFilter("EXECUTED")}
          className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
            filter === "EXECUTED"
              ? "bg-accent text-white"
              : "text-text-muted hover:bg-surface hover:text-text"
          }`}
        >
          Executed ({executedCount})
        </button>
        <button
          onClick={() => setFilter("BLOCKED")}
          className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
            filter === "BLOCKED"
              ? "bg-blocked text-white"
              : "text-text-muted hover:bg-surface hover:text-text"
          }`}
        >
          Blocked Attempts ({blockedCount})
        </button>
      </div>
      <label className="relative block sm:w-[270px]">
        <MagnifyingGlass size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" aria-hidden />
        <span className="sr-only">Search activity</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search activity" className="h-10 w-full rounded-lg border border-line bg-surface-raised pl-9 pr-3 text-xs text-text outline-none placeholder:text-text-faint focus:border-accent focus:ring-4 focus:ring-accent/10" />
      </label>
      </div>

      {loading ? (
        <div className="app-panel p-6">
          <SkeletonTableRows rows={5} />
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface-raised py-16 text-center text-xs text-text-muted">
          No records matching selected filter.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface-raised shadow-[0_10px_28px_rgba(16,24,40,0.04)]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line bg-surface text-text-muted">
              <tr>
                <th className="px-4 py-3.5 font-semibold">Timestamp</th>
                <th className="px-4 py-3.5 font-semibold">Status</th>
                <th className="px-4 py-3.5 font-semibold">Payee</th>
                <th className="px-4 py-3.5 font-semibold">Amount</th>
                <th className="px-4 py-3.5 font-semibold">Reason / details</th>
                <th className="px-4 py-3.5 text-right font-semibold">Arcscan proof</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredRequests.map((pr) => (
                <tr key={pr.id} className="transition-colors hover:bg-surface">
                  <td className="whitespace-nowrap px-4 py-3.5 text-text-muted">
                    {new Date(pr.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-md px-2 py-1 font-mono text-[10px] font-bold ${
                        pr.status === "EXECUTED"
                          ? "border border-accent/20 bg-accent-tint text-accent"
                          : pr.status === "BLOCKED"
                          ? "border border-blocked/20 bg-blocked-tint text-blocked"
                          : "border border-amber-600/20 bg-amber-50 text-amber-700"
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
                  <td className="whitespace-nowrap px-4 py-3.5 font-mono font-semibold text-text">
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
                    <span className="font-mono text-[10px] text-text-muted">Contract rule</span>
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
