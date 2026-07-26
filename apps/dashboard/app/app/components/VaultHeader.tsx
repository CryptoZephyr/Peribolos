"use client";

import { useState } from "react";
import type { Address } from "viem";
import {
  ArrowSquareOut,
  Copy,
  Check,
  ShieldCheck,
  ShieldWarning,
} from "@phosphor-icons/react";
import { addressUrl, formatUsdc, shortAddress, FAUCET_URL, BRIDGE_DOCS_URL } from "@/lib/chain";
import type { VaultStateData } from "./useVault";

export function VaultHeader({
  vaultAddress,
  state,
  isDemo,
}: {
  vaultAddress: Address;
  state: VaultStateData;
  isDemo: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(vaultAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can fail silently (permissions, insecure context); no UI is worth blocking on it.
    }
  };

  return (
    <div className="rounded-xl border border-line bg-surface-raised p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-text-faint">
          Vault
        </span>
        {isDemo && (
          <span className="rounded-full bg-accent-tint px-2.5 py-0.5 text-xs font-medium text-accent">
            Demo vault
          </span>
        )}
        <span
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            state.paused
              ? "bg-blocked-tint text-blocked"
              : "bg-accent-tint text-accent"
          }`}
        >
          {state.paused ? <ShieldWarning size={13} weight="bold" /> : <ShieldCheck size={13} weight="bold" />}
          {state.paused ? "Paused" : "Active"}
        </span>
        {state.identityRegistered && (
          <span className="rounded-full border border-line px-2.5 py-0.5 text-xs font-medium text-text-muted">
            ERC-8004 identity registered
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-sm text-text-muted">
            {shortAddress(vaultAddress)}
            <button
              onClick={handleCopy}
              className="text-text-faint transition-colors hover:text-text"
              title="Copy address"
            >
              {copied ? <Check size={14} weight="bold" /> : <Copy size={14} />}
            </button>
            <a
              href={addressUrl(vaultAddress)}
              target="_blank"
              rel="noreferrer"
              className="text-text-faint transition-colors hover:text-text"
              title="View on ArcScan"
            >
              <ArrowSquareOut size={14} />
            </a>
          </div>
          <div className="mt-2 font-mono text-4xl font-semibold text-text">
            {formatUsdc(state.balance)}
            <span className="ml-2 text-lg font-medium text-text-faint">USDC</span>
          </div>
        </div>

        <div className="flex flex-col items-start gap-1.5 text-xs sm:items-end">
          <span className="text-text-faint">Need testnet USDC?</span>
          <div className="flex items-center gap-3">
            <a
              href={FAUCET_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-accent transition-colors hover:text-text"
            >
              Circle faucet <ArrowSquareOut size={12} />
            </a>
            <a
              href={BRIDGE_DOCS_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-text-muted transition-colors hover:text-text"
            >
              Bridge via CCTP <ArrowSquareOut size={12} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
