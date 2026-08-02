"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle } from "@phosphor-icons/react";

export interface OnboardingState {
  hasAgent: boolean;
  hasVault: boolean;
  hasPayee: boolean;
  hasApiKey: boolean;
  hasExecutedPayment: boolean;
  hasActivity: boolean;
}

export function OnboardingWizard({ state }: { state: OnboardingState }) {
  const steps = [
    { id: 1, title: "1. Create an agent", desc: "Provision the managed signer", link: "/app/agents", completed: state.hasAgent },
    { id: 2, title: "2. Deploy a live vault", desc: "Set rules and fund the boundary", link: "/app/vaults", completed: state.hasVault },
    { id: 3, title: "3. Add a payee", desc: "Allow one trusted recipient", link: "/app/payees", completed: state.hasPayee },
    { id: 4, title: "4. Connect the agent key", desc: "Keep this browser on the right workspace", link: "/app/api-keys", completed: state.hasApiKey },
    { id: 5, title: "5. Send a test payment", desc: "Verify the managed signer works", link: "/app#payment-test", completed: state.hasExecutedPayment },
    { id: 6, title: "6. Review the proof", desc: "Confirm the decision in Activity", link: "/app/activity", completed: state.hasActivity },
  ];

  const completedCount = steps.filter((step) => step.completed).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);
  const nextStep = steps.find((step) => !step.completed);
  const setupComplete = !nextStep;

  return (
    <section aria-labelledby="workspace-setup-title" className="rounded-xl border border-accent/20 bg-accent/5 p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 border-b border-accent/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow text-accent">Activation path</p>
          <h2 id="workspace-setup-title" className="mt-2 text-lg font-semibold tracking-[-0.02em] text-text">
            {setupComplete ? "Your first protected payment is verified" : "Make your first protected payment"}
          </h2>
          <p className="mt-1 max-w-xl text-xs leading-5 text-text-muted">
            {setupComplete ? "Your agent, vault, payee, and audit trail are connected. You can now move to normal operations." : "Finish the short path below. Each step unlocks the next piece of the workspace."}
          </p>
        </div>
        <div className="flex items-center gap-3 lg:justify-end">
          <div className="text-right">
            <span className="text-xs font-mono font-bold text-accent">{completedCount} of {steps.length} complete</span>
            <span className="mt-0.5 block text-[11px] text-text-muted">{progressPercent}% ready</span>
          </div>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-line" aria-label={`${progressPercent}% activation complete`}>
            <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      {!setupComplete && nextStep && (
        <Link href={nextStep.link} className="group mt-5 flex items-center justify-between gap-4 rounded-lg border border-accent/25 bg-surface px-4 py-4 transition-colors hover:border-accent/50 hover:bg-surface-raised">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white"><ArrowRight size={15} weight="bold" /></span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent">Your next move</p>
              <p className="mt-1 text-sm font-semibold text-text">{nextStep.title.replace(/^\d+\.\s*/, "")}</p>
              <p className="mt-0.5 text-xs text-text-muted">{nextStep.desc}</p>
            </div>
          </div>
          <ArrowRight size={16} className="shrink-0 text-accent transition-transform group-hover:translate-x-1" />
        </Link>
      )}

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step) => (
          <Link
            key={step.id}
            href={step.link}
            className={`min-h-[96px] rounded-lg border p-3.5 transition-all group ${
              step.completed
                ? "border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50"
                : step.id === nextStep?.id
                  ? "border-accent/40 bg-surface shadow-sm hover:border-accent/60"
                  : "border-line bg-surface hover:border-accent/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-bold ${step.completed ? "text-emerald-400" : "text-accent group-hover:underline"}`}>
                {step.title.replace(/^\d+\.\s*/, "")}
              </span>
              {step.completed && <CheckCircle size={15} weight="fill" className="text-emerald-400" />}
            </div>
            <p className="mt-1 text-xs font-medium leading-snug text-text">{step.desc}</p>
          </Link>
        ))}
      </div>

      <p className="mt-4 text-[11px] leading-5 text-text-muted">Security simulations remain available from the sidebar. They do not move funds.</p>
    </section>
  );
}
