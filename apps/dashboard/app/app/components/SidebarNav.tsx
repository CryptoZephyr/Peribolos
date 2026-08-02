"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Pulse,
  ArrowsClockwise,
  Code,
  CreditCard,
  Gauge,
  Gear,
  Key,
  LockKey,
  PlugsConnected,
  Robot,
  ShieldCheck,
  UsersThree,
  Vault,
} from "@phosphor-icons/react";

const GROUPS = [
  {
    label: "Workspace",
    items: [
      ["Dashboard", "/app", Gauge],
      ["Agents", "/app/agents", Robot],
      ["Vaults", "/app/vaults", Vault],
      ["Payees", "/app/payees", UsersThree],
      ["Settings", "/app/settings", Gear],
    ],
  },
  {
    label: "Protection",
    items: [
      ["Activity & audit", "/app/activity", Pulse],
      ["Simulations", "/app/simulations", ArrowsClockwise],
      ["Security", "/app/security", ShieldCheck],
    ],
  },
  {
    label: "Developer",
    items: [
      ["API keys", "/app/api-keys", Key],
      ["Pricing", "/app/pricing", CreditCard],
    ],
  },
] as const;

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary navigation" className="space-y-7">
      {GROUPS.map((group) => (
        <div key={group.label}>
          <p className="px-3 text-xs font-semibold tracking-[0.04em] text-text-faint">
            {group.label}
          </p>
          <div className="mt-2 space-y-1">
            {group.items.map(([label, href, Icon]) => {
              const active = pathname === href || (href !== "/app" && pathname.startsWith(`${href}/`));
              return (
                <Link
                  key={href}
                  href={href}
                  prefetch
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all ${
                    active
                      ? "bg-text text-white shadow-sm"
                      : "text-text-muted hover:bg-surface hover:text-text"
                  }`}
                >
                  <Icon size={17} weight={active ? "fill" : "regular"} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
      <div className="border-t border-line pt-5 space-y-1">
        <a href="https://docs.arc.network" target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-text-muted hover:bg-surface hover:text-text">
          <Code size={17} />
          <span>Arc docs</span>
        </a>
        <Link href="/app/simulations" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-text-muted hover:bg-surface hover:text-text">
          <LockKey size={17} />
          <span>Policy simulator</span>
        </Link>
        <Link href="/app/api-keys" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-text-muted hover:bg-surface hover:text-text">
          <PlugsConnected size={17} />
          <span>Integrations</span>
        </Link>
      </div>
    </nav>
  );
}
