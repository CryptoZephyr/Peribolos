"use client";

import { ArrowUpRight } from "@phosphor-icons/react";
import { Reveal } from "./Reveal";
import { ARC_DOCS_URL } from "@/lib/chain";

const SIGNALS = [
  { value: "USDC", label: "native gas and balances" },
  { value: "EVM", label: "compatible smart contracts" },
  { value: "Arc", label: "settlement layer" },
];

export function ArcSignals() {
  return (
    <section className="border-b border-line bg-[#eef7f4] px-5 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto grid max-w-[1240px] gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-center lg:gap-20">
        <Reveal>
          <p className="eyebrow text-accent">Arc-native by design</p>
          <h2 className="mt-4 max-w-xl text-3xl font-medium leading-[1.08] tracking-[-0.045em] text-text sm:text-4xl">
            Stablecoin rails for autonomous spend.
          </h2>
          <p className="mt-4 max-w-md leading-relaxed text-text-muted">
            Peribolos uses Arc as the settlement layer for agent wallets, so policy, identity, and USDC movement live in the same programmable environment.
          </p>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-sm">
            <a href={ARC_DOCS_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-text underline decoration-accent/40 underline-offset-4 transition-colors hover:text-accent">
              Explore Arc docs
              <ArrowUpRight size={14} weight="bold" aria-hidden />
            </a>
            <a href="https://testnet.arcscan.app" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-text underline decoration-accent/40 underline-offset-4 transition-colors hover:text-accent">
              Open ArcScan
              <ArrowUpRight size={14} weight="bold" aria-hidden />
            </a>
          </div>
        </Reveal>

        <div className="grid gap-3 sm:grid-cols-3">
          {SIGNALS.map((signal) => (
            <Reveal key={signal.value} className="rounded-[14px] border border-accent/15 bg-white/70 p-5 shadow-[0_8px_24px_rgba(4,120,87,0.05)]">
              <p className="text-2xl font-semibold tracking-[-0.05em] text-text sm:text-3xl">{signal.value}</p>
              <p className="mt-2 max-w-[13ch] text-xs leading-5 text-text-muted">{signal.label}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
