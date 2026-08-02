"use client";

import { Reveal } from "./Reveal";
import { Code, Fingerprint, ShieldCheck, Wallet } from "@phosphor-icons/react";

const POINTS = [
  {
    icon: ShieldCheck,
    title: "On-chain enforcement",
    body: "The allowlist and caps are contract state, not a prompt rule. A payment must satisfy them before value can move.",
  },
  {
    icon: Wallet,
    title: "Limits that stay attached",
    body: "Daily and per-transaction ceilings travel with the vault, so every agent works inside an intentional budget.",
  },
  {
    icon: Fingerprint,
    title: "ERC-8004 identity",
    body: "Every vault mints the agent an on-chain identity NFT at creation, so who is spending is verifiable, not just claimed by the client.",
  },
  {
    icon: Code,
    title: "Ten-line SDK",
    body: "createPeribolosTools() drops three tools into an existing LangChain agent. No rewrite, no new infrastructure to run.",
  },
];

export function Defensible() {
  return (
    <section className="border-t border-line px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto max-w-[1240px]">
        <Reveal>
          <h2 className="max-w-xl text-3xl font-medium leading-tight tracking-tight text-text sm:text-4xl">
            What makes it hard to argue with.
          </h2>
        </Reveal>

        <div className="mt-14 max-w-3xl">
          {POINTS.map((point) => (
            <Reveal key={point.title}>
              <div className="grid grid-cols-[2.5rem_1fr] gap-5 border-t border-line py-8 first:border-t-0 sm:grid-cols-[3.5rem_1fr]">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-tint text-accent">
                  <point.icon size={17} weight="bold" aria-hidden />
                </span>
                <div>
                  <h3 className="text-lg font-medium text-text">
                    {point.title}
                  </h3>
                  <p className="mt-2 max-w-xl leading-relaxed text-text-muted">
                    {point.body}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
