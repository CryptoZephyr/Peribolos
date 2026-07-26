"use client";

import { useMemo, useState } from "react";
import type { Address } from "viem";
import { Pulse, ArrowClockwise, WarningCircle } from "@phosphor-icons/react";
import { ActivityRow, ActivityRowSkeleton } from "./ActivityRow";
import { useVaultActivity } from "./useVault";

type Filter = "all" | "blocked";

export function ActivityFeed({ vaultAddress }: { vaultAddress: Address }) {
  const [filter, setFilter] = useState<Filter>("all");
  const { data, isLoading, isError, refetch, isFetching } = useVaultActivity(vaultAddress);

  const filtered = useMemo(() => {
    if (!data) return [];
    return filter === "blocked" ? data.filter((e) => e.kind === "blocked") : data;
  }, [data, filter]);

  const blockedCount = data?.filter((e) => e.kind === "blocked").length ?? 0;

  return (
    <div className="rounded-xl border border-line bg-surface-raised p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-text-faint">
          <Pulse size={14} weight="bold" />
          Activity
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full border border-line bg-surface p-0.5 text-xs">
            <button
              onClick={() => setFilter("all")}
              className={`rounded-full px-3 py-1 font-medium transition-colors ${
                filter === "all" ? "bg-accent text-surface" : "text-text-muted hover:text-text"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("blocked")}
              className={`rounded-full px-3 py-1 font-medium transition-colors ${
                filter === "blocked" ? "bg-blocked text-surface" : "text-text-muted hover:text-text"
              }`}
            >
              Blocked{blockedCount > 0 ? ` (${blockedCount})` : ""}
            </button>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-text-faint transition-colors hover:text-text disabled:opacity-50"
            title="Refresh"
          >
            <ArrowClockwise size={15} className={isFetching ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {isLoading &&
          Array.from({ length: 5 }).map((_, i) => <ActivityRowSkeleton key={i} />)}

        {isError && !isLoading && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface px-4 py-8 text-center">
            <WarningCircle size={22} weight="bold" className="text-blocked" />
            <p className="text-sm text-text-muted">
              Could not load activity from Arc testnet. The RPC may be temporarily unreachable.
            </p>
            <button
              onClick={() => refetch()}
              className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-text transition-colors hover:border-line-strong"
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="rounded-xl border border-line bg-surface px-4 py-8 text-center text-sm text-text-muted">
            {filter === "blocked" ? "No blocked attempts yet." : "No activity yet."}
          </div>
        )}

        {!isLoading &&
          !isError &&
          filtered.map((event) => (
            <ActivityRow key={`${event.txHash}-${event.kind}`} event={event} />
          ))}
      </div>
    </div>
  );
}
