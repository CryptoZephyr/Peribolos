"use client";

import { BracketsCurly, CircleNotch, Cube, Lightning } from "@phosphor-icons/react";
import { Reveal } from "./Reveal";

const ECOSYSTEM = [
  { name: "Arc", detail: "Settlement layer", icon: Lightning },
  { name: "Circle Gateway", detail: "USDC rails", icon: CircleNotch },
  { name: "LangChain", detail: "Agent tooling", icon: BracketsCurly },
  { name: "ERC-8004", detail: "Agent identity", icon: Cube },
];

export function Ecosystem() {
  return (
    <section className="border-y border-line bg-surface-raised px-5 py-8 sm:px-8">
      <div className="mx-auto grid max-w-[1240px] gap-7 lg:grid-cols-[0.7fr_1.3fr] lg:items-center">
        <Reveal>
          <p className="eyebrow">The Arc stack</p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-text-muted">
            The pieces teams already use to ship agents, settle payments, and prove who is spending on-chain.
          </p>
        </Reveal>

        <div className="grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-4 sm:gap-3">
          {ECOSYSTEM.map(({ name, detail, icon: Icon }) => (
            <Reveal key={name} className="group flex items-center gap-3 sm:justify-center">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-line bg-surface text-text transition-colors group-hover:border-accent/30 group-hover:bg-accent-tint group-hover:text-accent">
                <Icon size={18} weight="bold" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold tracking-[-0.01em] text-text">{name}</span>
                <span className="block truncate text-[11px] text-text-faint">{detail}</span>
              </span>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
