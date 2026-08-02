"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle } from "@phosphor-icons/react";
import { Reveal } from "./Reveal";

const STEPS = [
  { number: "01", title: "Sign in", body: "Use email first, then register a passkey for this device." },
  { number: "02", title: "Connect the owner wallet", body: "Rabby approves the actions that belong to you, including deployment and funding." },
  { number: "03", title: "Create the boundary", body: "Provision an agent, set caps, allow a payee, and deploy a live vault on Arc." },
  { number: "04", title: "Verify one payment", body: "Send a small test request and see the policy decision, transaction, and audit proof." },
];

export function ActivationPath() {
  return (
    <section id="path" className="border-t border-line bg-surface-raised px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto grid max-w-[1240px] gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <Reveal>
          <p className="eyebrow">From sign-in to proof</p>
          <h2 className="mt-4 max-w-lg text-3xl font-medium leading-[1.06] tracking-[-0.045em] text-text sm:text-4xl">
            The finish line is one protected payment.
          </h2>
          <p className="mt-5 max-w-md leading-relaxed text-text-muted">
            Peribolos keeps the setup visible. You always know what is ready, what needs your approval, and what evidence you will have at the end.
          </p>
          <Link href="/login" className="mt-7 inline-flex items-center gap-2 rounded-lg bg-text px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent">
            Start the path <ArrowRight size={15} weight="bold" />
          </Link>
        </Reveal>

        <Reveal className="relative">
          <div className="absolute bottom-7 left-[22px] top-7 w-px bg-line" aria-hidden />
          <ol className="relative space-y-2">
            {STEPS.map((step, index) => (
              <li key={step.number} className="group grid grid-cols-[44px_1fr] gap-4 rounded-xl border border-transparent p-3 transition-colors hover:border-line hover:bg-surface">
                <span className="relative z-10 flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-surface text-xs font-mono font-semibold text-accent shadow-sm">{step.number}</span>
                <div className="pb-3 pt-0.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-text">{step.title}</h3>
                    {index === STEPS.length - 1 && <CheckCircle size={15} weight="fill" className="text-accent" />}
                  </div>
                  <p className="mt-1 max-w-lg text-xs leading-5 text-text-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}
