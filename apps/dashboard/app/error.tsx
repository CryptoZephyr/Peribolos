"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowsClockwise, ShieldCheck, House } from "@phosphor-icons/react";
import { PeribolosLogo } from "@/app/components/PeribolosLogo";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Uncaught Dashboard Runtime Error:", error);
  }, [error]);

  return (
    <div className="min-h-[100dvh] bg-surface flex flex-col justify-between p-6 sm:p-10 font-sans">
      <header className="flex items-center justify-between mx-auto w-full max-w-5xl">
        <Link href="/" aria-label="Peribolos home">
          <PeribolosLogo size={28} showBadge={false} />
        </Link>
        <span className="text-xs font-mono font-medium text-blocked bg-blocked-tint px-2.5 py-1 rounded-md border border-blocked/20">
          Runtime Protection Triggered
        </span>
      </header>

      <main className="mx-auto my-auto max-w-lg text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-blocked/30 bg-blocked-tint text-blocked">
          <ShieldCheck size={32} weight="bold" />
        </div>

        <div className="space-y-2">
          <p className="eyebrow text-blocked">Workspace Session Exception</p>
          <h1 className="text-3xl font-bold tracking-tight text-text sm:text-4xl">
            An unexpected error occurred.
          </h1>
          <p className="text-sm leading-relaxed text-text-muted">
            The workspace encountered an isolated client exception. Your underlying agent vaults and on-chain policies remain completely secure and enforced.
          </p>
          {error.digest && (
            <p className="text-[11px] font-mono text-text-faint bg-surface-raised border border-line p-2 rounded-md">
              Digest Code: {error.digest}
            </p>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-2 rounded-lg bg-text px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-accent transition-all"
          >
            <ArrowsClockwise size={15} />
            Try Again
          </button>
          <Link
            href="/app"
            className="flex items-center gap-2 rounded-lg border border-line bg-surface-raised px-5 py-2.5 text-xs font-semibold text-text hover:border-line-strong hover:bg-surface transition-all"
          >
            <House size={15} />
            Return to Dashboard
          </Link>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-5xl text-center text-xs text-text-faint pt-6 border-t border-line">
        Peribolos Smart Contract Vault Platform · Security Exception Handler
      </footer>
    </div>
  );
}
