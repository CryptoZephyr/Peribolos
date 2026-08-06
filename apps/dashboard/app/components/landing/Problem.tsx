import { Reveal } from "./Reveal";

export function Problem() {
  return (
    <section className="mx-auto max-w-[1240px] px-5 py-24 sm:px-8 sm:py-32">
      <Reveal className="max-w-2xl">
        <h2 className="text-3xl font-medium leading-tight tracking-tight text-text sm:text-4xl">
          Prompt injection already drains agent wallets.
        </h2>
        <p className="mt-5 text-base leading-relaxed text-text-muted">
          An attacker doesn&rsquo;t need the agent&rsquo;s private key. A
          poisoned web page, a malicious tool response, or a crafted
          instruction is often enough to talk a model into sending funds
          somewhere it shouldn&rsquo;t. A guardrail written into a prompt is a
          suggestion the same attacker can write around. A rule enforced by a
          smart contract is not.
        </p>
      </Reveal>

      <Reveal className="app-panel mt-10 max-w-2xl p-6 sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs font-medium text-text-faint">
            Example policy outcome
          </span>
          <span className="rounded-full border border-blocked/30 bg-blocked-tint px-2.5 py-1 text-xs font-medium text-blocked">
            PaymentBlocked
          </span>
        </div>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 font-mono text-sm">
          <dt className="text-text-faint">reason</dt>
          <dd className="text-text">RECIPIENT_NOT_ALLOWLISTED</dd>
          <dt className="text-text-faint">moved</dt>
          <dd className="text-text">0.00 USDC</dd>
        </dl>
        <p className="mt-4 text-sm text-text-muted">
          A blocked request records the policy reason and moves zero funds. A
          live transaction link appears only when an on-chain payment exists.
        </p>
      </Reveal>
    </section>
  );
}
