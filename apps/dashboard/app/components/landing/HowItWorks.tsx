import { Reveal } from "./Reveal";

export function HowItWorks() {
  return (
    <section id="how" className="border-t border-line px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-[1200px]">
        <Reveal>
          <h2 className="max-w-xl text-3xl font-medium leading-tight tracking-tight text-text sm:text-4xl">
            Two tiers, two enforcement models.
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-6 md:grid-cols-[3fr_2fr]">
          <Reveal className="rounded-[12px] border border-line bg-surface-raised p-8">
            <span className="text-sm font-medium text-accent">Vault tier</span>
            <h3 className="mt-3 text-2xl font-medium text-text">
              Rule-enforced, on-chain
            </h3>
            <p className="mt-4 max-w-md leading-relaxed text-text-muted">
              Every domain gets its own PeribolosVault contract. The
              recipient allowlist, per-transaction cap, and daily cap live in
              contract state, not app logic. <code className="font-mono text-text">pay()</code>{" "}
              never reverts: a blocked call still returns success and emits{" "}
              <code className="font-mono text-text">PaymentBlocked</code> with
              the reason, on-chain and permanent.
            </p>
          </Reveal>

          <Reveal className="rounded-[12px] border border-line bg-surface-raised p-8">
            <span className="text-sm font-medium text-text-faint">
              Petty-cash tier
            </span>
            <h3 className="mt-3 text-2xl font-medium text-text">
              Bounded by deposit
            </h3>
            <p className="mt-4 leading-relaxed text-text-muted">
              For paid APIs behind x402, the agent spends from a small Circle
              Gateway nanopayment deposit. There&rsquo;s no rule engine to
              check: the deposit itself is the ceiling.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
