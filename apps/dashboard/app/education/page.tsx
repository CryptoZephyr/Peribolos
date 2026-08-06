import Link from "next/link";
import type { Metadata } from "next";
import { FACTORY_ADDRESS, addressUrl } from "@/lib/chain";

export const metadata: Metadata = {
  title: "Education Center · Peribolos",
  description:
    "Why prompt injection breaks paying AI agents, why model-level guardrails cannot fully stop it, and why on-chain enforcement is a different kind of defense.",
};

export default function EducationPage() {
  return (
    <>
      <header className="border-b border-line px-6 py-6">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between">
          <Link href="/" className="text-[15px] font-medium tracking-tight text-text">
            Peribolos
          </Link>
          <Link
            href="/"
            className="text-sm text-text-muted transition-colors hover:text-text"
          >
            Back home
          </Link>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-[68ch] px-6 py-20 sm:py-28">
        <p className="text-sm font-medium uppercase tracking-wide text-text-faint">
          Education Center
        </p>
        <h1 className="mt-4 text-3xl font-medium leading-tight tracking-tight text-text sm:text-4xl">
          Why agents need a wall, not a warning.
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-text-muted">
          A paying AI agent is only as trustworthy as the content it reads.
          This page explains what prompt injection is, why keeping agents
          safe from it at the model layer alone is not enough, and what it
          means to enforce spending rules structurally instead.
        </p>

        <section className="mt-14">
          <h2 className="text-xl font-medium text-text">
            What prompt injection actually is
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-text-muted">
            <p>
              An AI agent that browses the web, calls tools, or reads emails
              on your behalf treats the text it encounters as context. Most
              of that context comes from places the agent&rsquo;s owner does
              not control: a web page, a document, an API response, another
              agent&rsquo;s message. The model has no reliable way to tell
              &ldquo;instructions from my operator&rdquo; apart from
              &ldquo;instructions embedded in a page I happened to read.&rdquo;
            </p>
            <p>
              Prompt injection is what happens when someone writes text
              specifically to be read by the agent instead of a human, and
              that text asks the model to do something the operator never
              intended, such as sending funds to a new address, ignoring its
              spending limits, or exfiltrating data. If the agent can spend
              money, this stops being an annoyance and becomes a direct path
              to a wallet.
            </p>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-medium text-text">
            Why guardrails at the model layer fail
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-text-muted">
            <p>
              System prompts, output filters, and alignment training all
              reduce how often a model falls for an injected instruction.
              None of them eliminate it. Defending against injection at the
              model layer is an ongoing arms race between attacker phrasing
              and defender training data, and the defender does not get to
              declare victory: a new phrasing, encoding, or framing can
              reopen the gap at any time.
            </p>
            <p>
              A rule that lives inside a prompt, a system message, or a
              fine-tune is still, structurally, a suggestion. It is text the
              model is being asked to follow, competing with other text the
              model is also being asked to follow. An attacker who controls
              enough of the input can make their instruction win.
            </p>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-medium text-text">
            What structural enforcement means
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-text-muted">
            <p>
              Peribolos moves the spending rules out of the model entirely
              and into a smart contract, the PeribolosVault, deployed for
              each spending domain. The recipient allowlist, the
              per-transaction cap, and the daily cap are contract state,
              checked by the Arc virtual machine itself when a payment call
              reaches the chain.
            </p>
            <p>
              This changes what an attack has to beat. Even if a prompt
              injection fully convinces the model to attempt a payment to an
              unapproved address, the attempt still has to pass the vault.
              The contract&rsquo;s <code className="font-mono text-text">pay()</code>{" "}
              function is written so that a blocked call does not revert or
              fail silently: it returns success and emits a{" "}
              <code className="font-mono text-text">PaymentBlocked</code>{" "}
              event with the reason, while moving zero funds. A successful
              attack against the model becomes a failed, permanently
              recorded attack against the wallet.
            </p>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-medium text-text">
            Two tiers, sized to the risk
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-text-muted">
            <p>
              Not every payment needs the same weight of enforcement. The
              vault tier handles meaningful transfers under explicit,
              owner-set rules. The SDK and demo-agent also support a lighter
              petty-cash path for paid API calls behind x402, spending from a
              small Circle Gateway nanopayment deposit. That separate path is
              not managed or displayed in this dashboard; the deposit itself
              is the ceiling.
            </p>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-medium text-text">
            Identity that is not just a claim
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-text-muted">
            <p>
              Peribolos requests an ERC-8004 identity registration when a vault
              is created. The registry call is best-effort and does not block
              domain creation, so a live identity record must be verified before
              treating it as evidence.
            </p>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-medium text-text">The record</h2>
          <div className="mt-4 space-y-4 leading-relaxed text-text-muted">
            <p>
              A blocked payment is recorded with its policy reason and moves
              nothing. Use the Activity screen and the linked explorer proof
              when a live vault produces a transaction.
            </p>
          </div>
          <div className="mt-4 rounded-[12px] border border-line bg-surface-raised p-6">
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
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-medium text-text">
            What this does not claim
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-text-muted">
            <p>
              Peribolos does not claim to stop prompt injection from
              happening, or to make a model immune to being fooled. It
              claims something narrower and more provable: that whatever the
              model is convinced to attempt, the funds still cannot move
              outside the rules the vault owner set. On Arc, checking those
              rules costs a fraction of a cent and settles in under a
              second, so enforcing them on every single call is cheap enough
              to actually do.
            </p>
          </div>
        </section>

        <section className="mt-16 border-t border-line pt-10">
          <p className="leading-relaxed text-text-muted">
            The factory contract that deploys every Peribolos vault is
            verified and public on Arc testnet:{" "}
            <a
              href={addressUrl(FACTORY_ADDRESS)}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-accent underline underline-offset-2 transition-colors hover:text-text"
            >
              {FACTORY_ADDRESS}
            </a>
            .
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/login"
              className="rounded-[12px] bg-accent px-6 py-3 text-sm font-medium text-surface transition-opacity hover:opacity-90"
            >
              Open app
            </Link>
            <Link
              href="/"
              className="rounded-[12px] border border-line px-6 py-3 text-sm font-medium text-text transition-colors hover:border-line-strong"
            >
              Back home
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
