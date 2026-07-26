import type { ReactNode } from "react";
import Link from "next/link";
import { Providers } from "@/app/providers";
import { ConnectButton } from "@/app/app/components/ConnectButton";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <div className="min-h-screen bg-surface flex flex-col">
        {/* Top Navbar */}
        <header className="border-b border-line bg-surface/90 backdrop-blur sticky top-0 z-40">
          <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-3.5">
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-2 text-base font-bold tracking-tight text-text">
                <span className="h-6 w-6 rounded-md bg-accent flex items-center justify-center text-white text-xs font-mono">P</span>
                <span>Peribolos <span className="text-xs font-normal text-text-muted px-1.5 py-0.5 rounded bg-surface-raised border border-line">V2 MVP</span></span>
              </Link>
              <nav className="hidden items-center gap-5 text-xs font-medium text-text-muted md:flex">
                <Link href="/app" className="transition-colors hover:text-text">Dashboard</Link>
                <Link href="/app/agents" className="transition-colors hover:text-text">Agents</Link>
                <Link href="/app/vaults" className="transition-colors hover:text-text">Vaults</Link>
                <Link href="/app/payees" className="transition-colors hover:text-text">Payees</Link>
                <Link href="/app/activity" className="transition-colors hover:text-text">Activity & Audit</Link>
                <Link href="/app/simulations" className="transition-colors hover:text-text">Simulations</Link>
                <Link href="/app/api-keys" className="transition-colors hover:text-text">API Keys</Link>
                <Link href="/app/pricing" className="transition-colors hover:text-text">Pricing</Link>
                <Link href="/app/security" className="transition-colors hover:text-text">Security</Link>
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Arc Testnet (5042002)
              </span>
              <ConnectButton />
            </div>
          </div>
        </header>

        {/* Subnav for mobile / desktop view */}
        <div className="border-b border-line bg-surface-raised/50 py-2 px-6 overflow-x-auto md:hidden">
          <div className="flex items-center gap-4 text-xs font-medium text-text-muted whitespace-nowrap">
            <Link href="/app" className="hover:text-text">Dashboard</Link>
            <Link href="/app/agents" className="hover:text-text">Agents</Link>
            <Link href="/app/vaults" className="hover:text-text">Vaults</Link>
            <Link href="/app/payees" className="hover:text-text">Payees</Link>
            <Link href="/app/activity" className="hover:text-text">Activity</Link>
            <Link href="/app/simulations" className="hover:text-text">Simulations</Link>
            <Link href="/app/api-keys" className="hover:text-text">API Keys</Link>
            <Link href="/app/pricing" className="hover:text-text">Pricing</Link>
          </div>
        </div>

        <main className="mx-auto max-w-[1280px] px-6 py-8 flex-1 w-full">{children}</main>

        <footer className="border-t border-line py-6 text-center text-xs text-text-muted">
          Peribolos Spending Control Platform • Powered by Arc & Circle • Contract-Enforced Financial Safety
        </footer>
      </div>
    </Providers>
  );
}
