"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ArrowUpRight, List, X } from "@phosphor-icons/react";

const groups = [
  {
    label: "Start",
    links: [
      { href: "/docs", label: "Overview" },
      { href: "/docs/getting-started", label: "Getting started" },
    ],
  },
  {
    label: "Build",
    links: [
      { href: "/docs/payment-api", label: "Payment API" },
      { href: "/docs/vaults", label: "Vault operations" },
      { href: "/docs/contracts", label: "Contracts & SDK" },
    ],
  },
  {
    label: "Operate",
    links: [
      { href: "/docs/security", label: "Security model" },
      { href: "/docs/reference", label: "API reference" },
    ],
  },
];

function DocsNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Documentation" className="space-y-7">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-text-faint">{group.label}</p>
          <ul className="space-y-1">
            {group.links.map((link) => {
              const active = pathname === link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-lg px-3 py-2 text-sm font-medium ${active ? "bg-accent-tint text-accent" : "text-text-muted hover:bg-surface hover:text-text"}`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function DocsShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="min-h-dvh bg-surface">
      <header className="sticky top-0 z-40 border-b border-line bg-surface-raised/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-5">
            <button type="button" onClick={() => setMenuOpen(true)} className="rounded-lg border border-line p-2 text-text lg:hidden" aria-label="Open documentation menu">
              <List size={18} />
            </button>
            <Link href="/" className="flex items-center gap-2 text-sm font-bold tracking-tight text-text">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent font-mono text-[11px] text-white">P</span>
              Peribolos <span className="font-normal text-text-faint">Docs</span>
            </Link>
            <span className="hidden rounded-full border border-line bg-surface px-2.5 py-1 font-mono text-[10px] text-text-faint sm:inline">Arc Testnet</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/app" className="hidden rounded-lg px-3 py-2 text-xs font-semibold text-text-muted hover:text-text sm:block">Dashboard</Link>
            <Link href="/login" className="inline-flex items-center gap-1 rounded-lg bg-text px-3.5 py-2 text-xs font-semibold text-white hover:bg-accent">
              Open app <ArrowUpRight size={13} weight="bold" />
            </Link>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-text/30" onClick={() => setMenuOpen(false)} aria-label="Close documentation menu" />
          <aside className="relative h-full w-[min(84vw,320px)] overflow-y-auto border-r border-line bg-surface-raised p-5 shadow-2xl">
            <div className="mb-7 flex items-center justify-between">
              <span className="text-sm font-bold text-text">Documentation</span>
              <button type="button" onClick={() => setMenuOpen(false)} className="rounded-lg border border-line p-2 text-text" aria-label="Close documentation menu"><X size={16} /></button>
            </div>
            <DocsNavigation onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden min-h-[calc(100dvh-4rem)] border-r border-line px-5 py-10 lg:block">
          <div className="sticky top-24"><DocsNavigation /></div>
        </aside>
        <main id="main-content" className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
