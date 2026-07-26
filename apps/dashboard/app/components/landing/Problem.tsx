import { txUrl } from "@/lib/chain";
import { Reveal } from "./Reveal";

/** Real blocked-injection attempt on Arc testnet, referenced from the education page too. */
export const BLOCKED_TX_HASH =
  "0xe052ac2a64ddd89db770aee8586b0a91fe637ccc8ac518672ed7d2f55f7959e4";

export function Problem() {
  return (
    <section className="mx-auto max-w-[1200px] px-6 py-24 sm:py-32">
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

      <Reveal className="mt-10 max-w-2xl rounded-[12px] border border-line bg-surface-raised p-6">
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs font-medium text-text-faint">
            On-chain evidence
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
          <dt className="text-text-faint">tx</dt>
          <dd>
            <a
              href={txUrl(BLOCKED_TX_HASH)}
              target="_blank"
              rel="noreferrer"
              className="break-all text-accent transition-colors hover:text-text underline underline-offset-2"
            >
              {BLOCKED_TX_HASH}
            </a>
          </dd>
        </dl>
        <p className="mt-4 text-sm text-text-muted">
          A real injected drain attempt on Arc testnet. The vault recorded it
          and moved nothing.
        </p>
      </Reveal>
    </section>
  );
}
