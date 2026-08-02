import type { ReactNode } from "react";
import Link from "next/link";
import { Providers } from "@/app/providers";
import { ConnectButton } from "@/app/app/components/ConnectButton";
import { ApiKeySetup } from "@/app/app/components/ApiKeySetup";
import { PeribolosLogo } from "@/app/components/PeribolosLogo";
import { AppAuthGate } from "@/app/app/components/AppAuthGate";
import { SidebarNav } from "@/app/app/components/SidebarNav";
import { WorkspaceHeader } from "@/app/app/components/WorkspaceHeader";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <div className="min-h-[100dvh] bg-surface text-text">
        <header className="sticky top-0 z-40 border-b border-line bg-surface-raised/90 backdrop-blur md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Link href="/" aria-label="Peribolos home"><PeribolosLogo size={25} showBadge={false} /></Link>
            <details className="relative">
                <summary aria-label="Open workspace navigation" className="flex h-9 cursor-pointer list-none items-center justify-center rounded-lg border border-line bg-surface-raised px-2 text-xs font-semibold text-text-muted hover:bg-surface hover:text-text [&::-webkit-details-marker]:hidden">Menu</summary>
                <div className="absolute right-0 top-12 z-50 w-[min(276px,calc(100vw-2rem))] rounded-xl border border-line bg-surface-raised p-4 shadow-[0_20px_56px_rgba(16,24,40,0.18)]">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                    <ApiKeySetup />
                    <ConnectButton />
                  </div>
                  <SidebarNav />
                </div>
            </details>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-[1540px]">
          <aside className="sticky top-0 hidden h-[100dvh] w-[236px] shrink-0 flex-col border-r border-line bg-surface-raised px-4 py-5 md:flex">
            <Link href="/" className="mb-9 px-3" aria-label="Peribolos home"><PeribolosLogo size={27} showBadge={false} /></Link>
            <SidebarNav />
            <div className="mt-auto rounded-lg border border-line bg-surface p-3 text-xs leading-relaxed text-text-faint">
              <div className="flex items-center gap-2 font-semibold text-text-muted"><span className="h-1.5 w-1.5 rounded-full bg-accent" /> Arc testnet</div>
              <p className="mt-1">Contract-enforced spending rules.</p>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <WorkspaceHeader />
            <main className="mx-auto w-full max-w-[1220px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8"><AppAuthGate>{children}</AppAuthGate></main>
          </div>
        </div>
      </div>
    </Providers>
  );
}
