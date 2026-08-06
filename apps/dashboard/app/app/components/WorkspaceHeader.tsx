"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CaretRight, Command, MagnifyingGlass, Plus, X } from "@phosphor-icons/react";
import { ApiKeySetup } from "./ApiKeySetup";
import { ConnectButton } from "./ConnectButton";

const ROUTES = [
  { href: "/app", label: "Dashboard", detail: "Workspace overview" },
  { href: "/app/agents", label: "Agents", detail: "Manage protected agents" },
  { href: "/app/vaults", label: "Vaults", detail: "Set spending rules" },
  { href: "/app/payees", label: "Payees", detail: "Approve recipients" },
  { href: "/app/activity", label: "Activity & audit", detail: "Review payment history" },
  { href: "/app/simulations", label: "Simulations", detail: "Test policy boundaries" },
  { href: "/app/api-keys", label: "API keys", detail: "Manage agent credentials" },
];

export function WorkspaceHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const current = useMemo(() => ROUTES.find((route) => route.href === pathname) ?? ROUTES.find((route) => pathname.startsWith(`${route.href}/`)) ?? ROUTES[0], [pathname]);
  const filteredRoutes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return ROUTES;
    return ROUTES.filter((route) => `${route.label} ${route.detail}`.toLowerCase().includes(normalizedQuery));
  }, [query]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query, open]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 hidden h-[68px] items-center justify-between border-b border-line bg-surface-raised/90 px-8 backdrop-blur md:flex">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
          <Link href="/app" className="font-medium text-text-muted hover:text-text">Workspace</Link>
          <CaretRight size={13} className="text-text-faint" aria-hidden />
          <span className="font-semibold text-text">{current.label}</span>
        </nav>

        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setOpen(true)} className="flex h-9 w-[270px] items-center gap-2 rounded-lg border border-line bg-surface px-3 text-left text-xs text-text-muted hover:border-line-strong hover:bg-surface-raised">
            <MagnifyingGlass size={15} aria-hidden />
            <span className="flex-1">Search commands</span>
            <kbd className="rounded border border-line bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] text-text-faint">Ctrl K</kbd>
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-accent/20 bg-accent-tint px-2.5 py-1.5 text-xs font-semibold text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Arc testnet
          </span>
          <ApiKeySetup />
          <Link href="/app/agents" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-text px-3 text-xs font-semibold text-white hover:bg-accent"><Plus size={14} weight="bold" /> New agent</Link>
          <ConnectButton />
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-text/20 p-4 pt-[14vh] backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Command launcher">
          <div className="w-full max-w-[560px] overflow-hidden rounded-xl border border-line-strong bg-surface-raised shadow-[0_24px_80px_rgba(16,24,40,0.22)]">
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              <MagnifyingGlass size={17} className="text-text-muted" aria-hidden />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setHighlightedIndex((index) => filteredRoutes.length ? (index + 1) % filteredRoutes.length : 0);
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setHighlightedIndex((index) => filteredRoutes.length ? (index - 1 + filteredRoutes.length) % filteredRoutes.length : 0);
                  } else if (event.key === "Enter" && filteredRoutes[highlightedIndex]) {
                    event.preventDefault();
                    window.location.assign(filteredRoutes[highlightedIndex].href);
                    setOpen(false);
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    setOpen(false);
                  }
                }}
                placeholder="Jump to a workspace"
                aria-label="Search workspace commands"
                className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-muted"
              />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close command launcher" className="rounded-md p-1 text-text-muted hover:bg-surface hover:text-text"><X size={16} /></button>
            </div>
            <div className="p-2">
              {filteredRoutes.length === 0 && <p className="px-3 py-5 text-center text-xs text-text-muted">No matching workspace command.</p>}
              {filteredRoutes.map((route, index) => (
                <Link key={route.href} href={route.href} onClick={() => setOpen(false)} className={`flex items-center justify-between rounded-lg px-3 py-3 ${index === highlightedIndex ? "bg-surface" : "hover:bg-surface"}`} aria-current={index === highlightedIndex ? "true" : undefined}>
                  <span><span className="block text-sm font-semibold text-text">{route.label}</span><span className="mt-0.5 block text-xs text-text-muted">{route.detail}</span></span>
                  <CaretRight size={16} className="text-text-faint" />
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-2 border-t border-line px-4 py-3 text-xs text-text-faint"><Command size={14} /> Use Ctrl K from any workspace screen.</div>
          </div>
        </div>
      )}
    </>
  );
}
