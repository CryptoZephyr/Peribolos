"use client";

import { useState } from "react";
import type { Address, Hex } from "viem";
import {
  ArrowSquareOut,
  Broom,
  Pause,
  Play,
  SlidersHorizontal,
  DownloadSimple,
} from "@phosphor-icons/react";
import { formatUsdc, txUrl } from "@/lib/chain";
import { describeError } from "@/lib/errors";
import { vaultAbi } from "./useVault";
import { useSession } from "../session";

export function OwnerControls({
  vaultAddress,
  owner,
  paused,
  balance,
  onSettled,
}: {
  vaultAddress: Address;
  owner: Address;
  paused: boolean;
  balance: bigint;
  onSettled: () => void;
}) {
  const { address, isConnected, method, writeVault } = useSession();
  const [pendingAction, setPendingAction] = useState<
    "pause" | "unpause" | "sweep" | "withdraw" | null
  >(null);
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const isOwner = Boolean(isConnected && address && address.toLowerCase() === owner.toLowerCase());
  const disabledTitle = "Connect the owner wallet to control this vault.";
  const busy = pendingAction !== null;

  async function call(action: "pause" | "unpause" | "sweep") {
    setError(null);
    setTxHash(null);
    setPendingAction(action);
    try {
      const hash = await writeVault({
        address: vaultAddress,
        abi: vaultAbi,
        functionName: action === "sweep" ? "sweepIdle" : action,
        args: [],
      });
      setTxHash(hash);
      onSettled();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPendingAction(null);
    }
  }

  async function withdraw() {
    setError(null);
    setTxHash(null);
    setPendingAction("withdraw");
    try {
      const human = withdrawAmount.trim() || formatUsdc(balance, 6);
      const parts = human.split(".");
      const whole = BigInt(parts[0] || "0");
      const frac = (parts[1] || "").padEnd(6, "0").slice(0, 6);
      const amount = whole * 1_000_000n + BigInt(frac || "0");
      if (amount <= 0n) throw new Error("Enter a withdraw amount greater than zero.");
      const hash = await writeVault({
        address: vaultAddress,
        abi: vaultAbi,
        functionName: "withdraw",
        args: [amount],
      });
      setTxHash(hash);
      setWithdrawAmount("");
      onSettled();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-surface-raised p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-text-faint">
          <SlidersHorizontal size={14} weight="bold" />
          Owner controls
        </div>
        {isOwner && method === "passkey" && (
          <span className="rounded-full bg-accent-tint px-2 py-0.5 text-[10px] font-medium text-accent">
            gasless via passkey
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-3" title={!isOwner ? disabledTitle : undefined}>
        {paused ? (
          <button
            onClick={() => call("unpause")}
            disabled={!isOwner || busy}
            className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-medium text-surface transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:bg-surface-overlay disabled:text-text-faint"
          >
            <Play size={15} weight="bold" />
            {busy && pendingAction === "unpause" ? "Unpausing" : "Unpause"}
          </button>
        ) : (
          <button
            onClick={() => call("pause")}
            disabled={!isOwner || busy}
            className="flex items-center gap-1.5 rounded-full border border-line-strong px-4 py-2 text-sm font-medium text-text transition-colors hover:border-blocked hover:text-blocked disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Pause size={15} weight="bold" />
            {busy && pendingAction === "pause" ? "Pausing" : "Pause"}
          </button>
        )}

        <button
          onClick={() => call("sweep")}
          disabled={!isOwner || busy}
          className="flex items-center gap-1.5 rounded-full border border-line-strong px-4 py-2 text-sm font-medium text-text transition-colors hover:border-line-strong hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Broom size={15} weight="bold" />
          {busy && pendingAction === "sweep" ? "Sweeping" : "Sweep idle"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <input
          inputMode="decimal"
          placeholder={formatUsdc(balance)}
          value={withdrawAmount}
          onChange={(e) => setWithdrawAmount(e.target.value)}
          disabled={!isOwner || busy}
          className="w-28 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent disabled:opacity-50"
          aria-label="Withdraw amount USDC"
        />
        <button
          onClick={() => void withdraw()}
          disabled={!isOwner || busy || balance === 0n}
          className="flex items-center gap-1.5 rounded-full border border-line-strong px-4 py-2 text-sm font-medium text-text transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <DownloadSimple size={15} weight="bold" />
          {busy && pendingAction === "withdraw" ? "Withdrawing…" : "Withdraw"}
        </button>
        <span className="text-[11px] text-text-faint">to owner · leave blank for full balance</span>
      </div>

      {!isOwner && <p className="mt-3 text-xs text-text-faint">{disabledTitle}</p>}

      {error && <p className="mt-3 text-xs text-blocked">{error}</p>}

      {txHash && (
        <a
          href={txUrl(txHash)}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex items-center gap-1 text-xs text-text-faint transition-colors hover:text-text"
        >
          View transaction <ArrowSquareOut size={13} />
        </a>
      )}
    </div>
  );
}
