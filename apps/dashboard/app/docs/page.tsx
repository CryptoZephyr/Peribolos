import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { DocPage, Section, Callout } from "./_components/DocPage";

const toc = [{ id: "model", label: "The model" }, { id: "path", label: "Recommended path" }, { id: "outcomes", label: "Truthful outcomes" }];

export default function DocsOverview() {
  return <DocPage eyebrow="Documentation" title="Give agents a budget, not a blank check." description="Peribolos combines an Arc Testnet vault, a managed agent signer, and a hosted payment API. The agent can request payments; the owner-controlled contract decides what can move." toc={toc}>
    <Section id="model" title="The model">
      <p>The security boundary is the <strong className="font-semibold text-text">PeribolosVault contract</strong>. Daily caps, per-transaction caps, action permissions, allowlisted recipients, expiry, and pause state are enforced on Arc. Dashboard records are a useful mirror, never a substitute for live contract state.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        {[['Owner', 'Deploys, funds, pauses, changes rules, and rotates the agent key from a browser wallet.'], ['Agent', 'Holds a scoped payment API key and can only propose payments for its assigned vault.'], ['Vault', 'Moves funds only when every on-chain rule passes; blocked attempts move no funds.']].map(([title, text], index) => <div key={title} className="rounded-xl border border-line bg-surface-raised p-5"><span className="font-mono text-xs text-accent">0{index + 1}</span><h3 className="mt-4 font-semibold text-text">{title}</h3><p className="mt-2 text-sm leading-6">{text}</p></div>)}
      </div>
    </Section>
    <Section id="path" title="Recommended path">
      <ol className="space-y-3">{['Create an agent. Peribolos provisions its managed Arc Testnet signer and returns the agent API key once.', 'Deploy a vault with that signer address, then attach it. Peribolos reads owner and rule state directly from Arc.', 'Fund from the owner wallet and call POST /v1/payments from any agent framework.', 'Use the owner controls for live pause, rules, withdrawals, and signer rotation.'].map((step, index) => <li key={step} className="flex gap-4 rounded-xl border border-line bg-surface-raised p-4"><span className="font-mono text-xs font-bold text-accent">{index + 1}</span><span>{step}</span></li>)}</ol>
      <Link href="/docs/getting-started" className="inline-flex items-center gap-2 rounded-lg bg-text px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent">Start the integration <ArrowRight size={15} /></Link>
    </Section>
    <Section id="outcomes" title="Truthful outcomes">
      <p>The payment endpoint separates policy decisions from infrastructure failure:</p>
      <div className="grid gap-3 sm:grid-cols-3"><Callout tone="success" title="EXECUTED">A confirmed Arc transaction moved the requested funds.</Callout><Callout tone="warning" title="BLOCKED">The vault rejected a rule-breaking request and reports the contract reason.</Callout><Callout title="FAILED">No execution claim is made—for example, the vault is offline or the chain transaction could not be confirmed.</Callout></div>
    </Section>
  </DocPage>;
}
