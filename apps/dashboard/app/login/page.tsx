"use client";

/**
 * Standalone sign-in page. Wallet (MetaMask) + optional passkey via Circle
 * Modular Wallets (when NEXT_PUBLIC_CIRCLE_CLIENT_* is set). No backend, no
 * custody. Redirects to the dashboard once a session is connected.
 *
 * Passkey path: https://developers.circle.com/wallets/modular
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wallet, ArrowRight, ShieldCheck, Fingerprint, CircleNotch } from "@phosphor-icons/react";
import { useSession } from "@/app/app/session";

export default function LoginPage() {
  const {
    isConnected,
    connectWallet,
    walletConnecting,
    passkeyConfigured,
    passkeyBusy,
    signInWithPasskey,
  } = useSession();
  const router = useRouter();
  const [passkeyUsername, setPasskeyUsername] = useState("peribolos-owner");
  const [passkeyError, setPasskeyError] = useState<string | null>(null);

  useEffect(() => {
    if (isConnected) router.replace("/app");
  }, [isConnected, router]);

  const onPasskey = async (mode: "register" | "login") => {
    setPasskeyError(null);
    try {
      await signInWithPasskey(mode, passkeyUsername.trim() || "peribolos-owner");
    } catch (err) {
      setPasskeyError(err instanceof Error ? err.message : "Passkey sign-in failed.");
    }
  };

  return (
    <main className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-surface">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-10%] h-[520px] w-[520px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(52,211,153,0.16), transparent 70%)" }}
      />

      <header className="relative px-6 py-6">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between">
          <Link href="/" className="text-[15px] font-medium tracking-tight text-text">
            Peribolos
          </Link>
          <Link href="/" className="text-sm text-text-muted transition-colors hover:text-text">
            Back home
          </Link>
        </div>
      </header>

      <div className="relative flex flex-1 items-center justify-center px-6 pb-24">
        <div className="w-full max-w-[400px]">
          <div className="flex flex-col items-center text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-surface-raised">
              <ShieldCheck size={20} weight="bold" className="text-accent" />
            </span>
            <h1 className="mt-6 text-2xl font-medium tracking-tight text-text">
              Sign in to your vaults
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-text-muted">
              Connect a wallet or passkey to create and manage rule-enforced spending domains
              on Arc testnet. No account, no password, no custody.
            </p>
          </div>

          <button
            onClick={connectWallet}
            disabled={walletConnecting || Boolean(passkeyBusy)}
            className="group mt-8 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-accent px-6 py-3.5 text-sm font-semibold text-surface transition-all hover:bg-accent-deep active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Wallet size={17} weight="bold" />
            {walletConnecting ? "Connecting…" : "Connect wallet"}
          </button>

          {passkeyConfigured && (
            <div className="mt-4 space-y-3 rounded-2xl border border-line bg-surface-raised p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-faint">
                <Fingerprint size={14} className="text-accent" />
                Passkey · Circle Modular Wallets
              </div>
              <p className="text-xs leading-relaxed text-text-muted">
                Gasless owner actions via a device passkey smart account on Arc testnet.
              </p>
              <input
                type="text"
                value={passkeyUsername}
                onChange={(e) => setPasskeyUsername(e.target.value)}
                placeholder="Display name"
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-text outline-none transition-colors placeholder:text-text-faint focus:border-accent"
                disabled={Boolean(passkeyBusy)}
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onPasskey("login")}
                  disabled={Boolean(passkeyBusy)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-line px-3 py-2.5 text-sm font-medium text-text transition-colors hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {passkeyBusy === "login" ? (
                    <CircleNotch size={15} className="animate-spin" />
                  ) : (
                    <Fingerprint size={15} />
                  )}
                  Sign in
                </button>
                <button
                  onClick={() => onPasskey("register")}
                  disabled={Boolean(passkeyBusy)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-line px-3 py-2.5 text-sm font-medium text-text transition-colors hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {passkeyBusy === "register" ? (
                    <CircleNotch size={15} className="animate-spin" />
                  ) : null}
                  Create passkey
                </button>
              </div>
              {passkeyError && (
                <p className="text-xs text-blocked">{passkeyError}</p>
              )}
            </div>
          )}

          <Link
            href="/app"
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-line px-6 py-3.5 text-sm font-medium text-text transition-colors hover:border-line-strong"
          >
            View the live demo
            <ArrowRight size={15} />
          </Link>

          <p className="mt-8 text-center text-xs leading-relaxed text-text-faint">
            Your keys stay in your wallet or device. Which vaults you own lives on-chain.
            There is no Peribolos backend to breach.
          </p>
        </div>
      </div>
    </main>
  );
}
