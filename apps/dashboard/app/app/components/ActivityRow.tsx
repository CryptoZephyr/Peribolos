"use client";

import { memo } from "react";
import { ArrowSquareOut, Prohibit, ShieldCheck } from "@phosphor-icons/react";
import { formatUsdc, shortAddress, txUrl } from "@/lib/chain";
import { REASON_EXPLANATION, REASON_LABEL } from "@/lib/reasons";
import type { ActivityRowData } from "./useVault";

function formatTimestamp(timestamp: bigint | undefined, blockNumber: bigint): string {
  if (timestamp === undefined) return `Block ${blockNumber.toString()}`;
  return new Date(Number(timestamp) * 1000).toLocaleString();
}

export const ActivityRow = memo(function ActivityRow({ event }: { event: ActivityRowData }) {
  const blocked = event.kind === "blocked";

  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
        blocked ? "border-line bg-blocked-tint" : "border-line bg-surface"
      }`}
    >
      <div className="flex items-start gap-3">
        {blocked ? (
          <Prohibit size={18} weight="bold" className="mt-0.5 shrink-0 text-blocked" />
        ) : (
          <ShieldCheck size={18} weight="bold" className="mt-0.5 shrink-0 text-accent" />
        )}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-text">{shortAddress(event.to)}</span>
            <span className="font-mono text-sm font-medium text-text">
              {formatUsdc(event.amount)} USDC
            </span>
            {blocked && event.reason !== undefined && (
              <span className="rounded-full bg-blocked-tint px-2 py-0.5 text-xs font-medium text-blocked">
                {REASON_LABEL[event.reason]}
              </span>
            )}
          </div>
          {blocked && event.reason !== undefined && (
            <p className="mt-1 max-w-lg text-xs text-text-muted">
              {REASON_EXPLANATION[event.reason]}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 pl-8 sm:pl-0">
        <span className="font-mono text-xs text-text-faint">
          {formatTimestamp(event.timestamp, event.blockNumber)}
        </span>
        <a
          href={txUrl(event.txHash)}
          target="_blank"
          rel="noreferrer"
          className="text-text-faint transition-colors hover:text-text"
          title="View transaction on ArcScan"
        >
          <ArrowSquareOut size={15} />
        </a>
      </div>
    </div>
  );
});

export function ActivityRowSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="h-[18px] w-[18px] animate-pulse rounded-full bg-surface-overlay" />
        <div className="space-y-2">
          <div className="h-3.5 w-48 animate-pulse rounded bg-surface-overlay" />
          <div className="h-3 w-32 animate-pulse rounded bg-surface-overlay" />
        </div>
      </div>
      <div className="h-3.5 w-20 animate-pulse rounded bg-surface-overlay" />
    </div>
  );
}
