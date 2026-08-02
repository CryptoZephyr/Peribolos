"use client";

/**
 * Wallet sign-in control for the dashboard header.
 *
 * Wallet-only for now: MetaMask via wagmi, non-custodial, no backend. The
 * passkey / smart-account path still lives in session.tsx and can be surfaced
 * again later ("account abstraction, TBD"); it is intentionally not shown here.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet, CaretDown, SignOut } from "@phosphor-icons/react";
import { shortAddress } from "@/lib/chain";
import { useSession } from "../session";
import { useSupabaseAuth } from "@/app/auth/SupabaseAuthProvider";
import { useToast } from "@/app/components/Toast";

const API_KEY_STORAGE = "peribolos.apiKey.v1";

export function ConnectButton() {
  const { address, isConnected, connectWallet, walletConnecting, disconnect } = useSession();
  const { user, signOut } = useSupabaseAuth();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncApiKey = () => setApiKeyConfigured(Boolean(window.localStorage.getItem(API_KEY_STORAGE)));
    syncApiKey();
    window.addEventListener("peribolos-api-key-changed", syncApiKey);
    return () => window.removeEventListener("peribolos-api-key-changed", syncApiKey);
  }, []);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await signOut();
      disconnect();
      window.localStorage.removeItem(API_KEY_STORAGE);
      window.dispatchEvent(new Event("peribolos-api-key-changed"));
      setOpen(false);
      router.replace("/login");
    } catch (error) {
      toast.error("Could not log out", error instanceof Error ? error.message : "Try again shortly.");
    } finally {
      setLoggingOut(false);
    }
  }

  if ((isConnected && address) || user || apiKeyConfigured) {
    const accountLabel = address ? shortAddress(address) : user?.email ?? "API key session";
    return (
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-full border border-line bg-surface-raised px-3 py-1.5 text-sm text-text transition-colors hover:border-line-strong"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
          <span className={address ? "font-mono text-text-muted" : "max-w-[180px] truncate text-text-muted"}>{accountLabel}</span>
          <CaretDown size={12} className="text-text-faint" />
        </button>
        {open && (
          <div className="absolute right-0 z-50 mt-2 w-44 rounded-xl border border-line bg-surface-overlay p-2 shadow-xl shadow-black/40">
            {isConnected && address && (
              <button
                onClick={() => {
                  disconnect();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-text transition-colors hover:bg-surface-raised"
              >
                <Wallet size={15} /> Disconnect wallet
              </button>
            )}
            <button
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-text transition-colors hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-60"
            >
              <SignOut size={15} /> {loggingOut ? "Logging out..." : "Log out"}
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
