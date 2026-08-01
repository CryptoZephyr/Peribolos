"use client";

/**
 * Wallet sign-in control for the dashboard header.
 *
 * Wallet-only for now: MetaMask via wagmi, non-custodial, no backend. The
 * passkey / smart-account path still lives in session.tsx and can be surfaced
 * again later ("account abstraction, TBD"); it is intentionally not shown here.
 */

import { useEffect, useRef, useState } from "react";
import { Wallet, CaretDown, SignOut } from "@phosphor-icons/react";
import { shortAddress } from "@/lib/chain";
import { useSession } from "../session";

export function ConnectButton() {
  const { address, isConnected, connectWallet, walletConnecting, disconnect } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (isConnected && address) {
    return (
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-full border border-line bg-surface-raised px-3 py-1.5 text-sm text-text transition-colors hover:border-line-strong"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          <span className="font-mono text-text-muted">{shortAddress(address)}</span>
          <CaretDown size={12} className="text-text-faint" />
        </button>
        {open && (
          <div className="absolute right-0 z-50 mt-2 w-44 rounded-xl border border-line bg-surface-overlay p-2 shadow-xl shadow-black/40">
            <button
              onClick={() => {
                disconnect();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-text transition-colors hover:bg-surface-raised"
            >
              <SignOut size={15} /> Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={connectWallet}
        disabled={walletConnecting}
        className="flex items-center gap-2 rounded-full bg-accent px-3.5 py-1.5 text-sm font-medium text-surface transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Wallet size={16} weight="bold" />
        {walletConnecting ? "Connecting…" : "Connect wallet"}
      </button>
    </div>
  );
}
