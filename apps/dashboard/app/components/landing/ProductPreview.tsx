"use client";

import { ArrowUpRight, CaretDown, CheckCircle, DotsThree, ShieldCheck, WarningCircle } from "@phosphor-icons/react";
import { Reveal } from "./Reveal";

const EVENTS = [
  { action: "peribolos_pay", recipient: "api.openai.com", amount: "$18.40", status: "Allowed", tone: "allowed" },
  { action: "peribolos_pay", recipient: "unknown-wallet.eth", amount: "$0.00", status: "Blocked", tone: "blocked" },
  { action: "peribolos_buy", recipient: "api.anthropic.com", amount: "$42.80", status: "Allowed", tone: "allowed" },
];

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
              <button type="button" className="flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-[11px] font-medium text-text-muted hover:border-line-strong hover:text-text">
                Last 7 days
                <CaretDown size={12} aria-hidden />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 border-b border-line bg-surface px-4 py-4 sm:gap-3 sm:px-5">
              <div>
                <p className="text-[11px] text-text-faint">USDC balance</p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.04em] text-text">$2,840.20</p>
              </div>
              <div>
                <p className="text-[11px] text-text-faint">Daily cap</p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.04em] text-text">$500.00</p>
              </div>
              <div>
                <p className="text-[11px] text-text-faint">Blocked</p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.04em] text-blocked">12</p>
              </div>
            </div>

            <div className="px-4 py-4 sm:px-5 sm:py-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold text-text">Recent activity</p>
                <button type="button" className="text-text-faint transition-colors hover:text-text" aria-label="More activity options">
                  <DotsThree size={18} weight="bold" aria-hidden />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-xs">
                  <thead className="border-b border-line text-[10px] uppercase tracking-[0.08em] text-text-faint">
                    <tr>
                      <th className="pb-2 font-medium">Tool call</th>
                      <th className="pb-2 font-medium">Recipient</th>
                      <th className="pb-2 text-right font-medium">Amount</th>
                      <th className="pb-2 pl-4 text-right font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {EVENTS.map((event) => (
                      <tr key={`${event.action}-${event.recipient}`} className="border-b border-line last:border-0">
                        <td className="py-3 font-mono text-[11px] text-text">{event.action}</td>
                        <td className="py-3 text-text-muted">{event.recipient}</td>
                        <td className="py-3 text-right font-mono text-[11px] text-text">{event.amount}</td>
                        <td className="py-3 pl-4 text-right">
                          <span className={`inline-flex items-center gap-1 ${event.tone === "blocked" ? "text-blocked" : "text-accent"}`}>
                            {event.tone === "blocked" ? <WarningCircle size={13} weight="bold" aria-hidden /> : <CheckCircle size={13} weight="bold" aria-hidden />}
                            {event.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
