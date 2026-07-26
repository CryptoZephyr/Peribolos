"use client";

import { Gauge } from "@phosphor-icons/react";
import { formatUsdc } from "@/lib/chain";
import type { VaultStateData } from "./useVault";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line py-2.5 last:border-b-0">
      <span className="text-sm text-text-muted">{label}</span>
      <span className="font-mono text-sm text-text">{value}</span>
    </div>
  );
}

export function RulesPanel({ state }: { state: VaultStateData }) {
  const expiryDate = new Date(Number(state.agentExpiry) * 1000);
  const expired = state.agentExpiry * 1000n < BigInt(Date.now());

  return (
    <div className="rounded-xl border border-line bg-surface-raised p-6">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-text-faint">
        <Gauge size={14} weight="bold" />
        Rules
      </div>
      <div className="mt-3">
        <Row label="Per-transaction cap" value={`${formatUsdc(state.perTxCap)} USDC`} />
        <Row label="Daily cap" value={`${formatUsdc(state.dailyCap)} USDC`} />
        <Row label="Spent today" value={`${formatUsdc(state.epochSpent)} USDC`} />
        <Row label="Float (always available)" value={`${formatUsdc(state.floatAmount)} USDC`} />
        <div className="flex items-center justify-between py-2.5">
          <span className="text-sm text-text-muted">Agent key expiry</span>
          <span
            className={`font-mono text-sm ${expired ? "text-blocked" : "text-text"}`}
          >
            {expiryDate.toLocaleString()}
            {expired ? " (expired)" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
