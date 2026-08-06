"use client";

import { ArrowUpRight, CheckCircle, ShieldCheck, WarningCircle } from "@phosphor-icons/react";
import { Reveal } from "./Reveal";

export function ProductPreview() {
  return (
    <section id="product" className="border-t border-line bg-[#fbfcfd] px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto grid max-w-[1240px] gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:items-center lg:gap-16">
        <Reveal>
          <p className="eyebrow">Inside the control plane</p>
          <h2 className="mt-4 max-w-lg text-3xl font-medium leading-[1.06] tracking-[-0.045em] text-text sm:text-4xl">
            See what your agents can spend before they spend it.
          </h2>
          <p className="mt-5 max-w-md leading-relaxed text-text-muted">
            Peribolos turns wallet policy into a workspace your team can inspect: live caps, recipient rules, and an audit trail that does not disappear when the prompt changes.
          </p>
          <a href="#how" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-text underline decoration-line underline-offset-4 transition-colors hover:text-accent">
            See the enforcement model
            <ArrowUpRight size={15} weight="bold" aria-hidden />
          </a>
        </Reveal>

        <Reveal>
          <div className="overflow-hidden rounded-[20px] border border-line bg-surface-raised shadow-[0_24px_60px_rgba(16,24,40,0.1)]">
            <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-tint text-accent">
                  <ShieldCheck size={15} weight="bold" aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-semibold text-text">Peribolos workspace</p>
                  <p className="text-[11px] text-text-faint">Arc testnet policies</p>
                </div>
              </div>
              <span className="text-[11px] font-medium text-text-faint">Illustrative policy snapshot</span>
            </div>

            <div className="grid gap-3 border-b border-line bg-surface px-4 py-4 sm:grid-cols-3 sm:gap-4 sm:px-5">
              <div>
                <p className="text-[11px] text-text-faint">Recipient rules</p>
                <p className="mt-1 text-sm font-semibold text-text">Allowlisted only</p>
              </div>
              <div>
                <p className="text-[11px] text-text-faint">Budget checks</p>
                <p className="mt-1 text-sm font-semibold text-text">Per transaction + daily</p>
              </div>
              <div>
                <p className="text-[11px] text-text-faint">Settlement</p>
                <p className="mt-1 text-sm font-semibold text-accent">Blocked before funds move</p>
              </div>
            </div>

            <div className="px-4 py-4 sm:px-5 sm:py-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold text-text">Every payment request is checked against policy</p>
              </div>
              <div className="grid gap-2 text-xs sm:grid-cols-2">
                <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-3 text-text-muted">
                  <CheckCircle size={15} weight="bold" className="shrink-0 text-accent" aria-hidden />
                  Approved requests continue to settlement.
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-3 text-text-muted">
                  <WarningCircle size={15} weight="bold" className="shrink-0 text-blocked" aria-hidden />
                  Unapproved requests are rejected with a reason.
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
