import type { Metadata } from "next";
import { FACTORY_ADDRESS, USDC, IDENTITY_REGISTRY, CHAIN_ID, addressUrl } from "@/lib/chain";
import { CodeBlock } from "../CodeBlock";
import { DocPage, Section, Callout } from "../_components/DocPage";

export const metadata: Metadata = { title: "Contracts & SDK" };
const toc = [{ id: "network", label: "Network" }, { id: "vault", label: "Vault interface" }, { id: "sdk", label: "Local SDK" }];

export default function ContractsPage() {
  const addresses = [['Factory', FACTORY_ADDRESS], ['Native USDC token interface', USDC], ['Identity registry', IDENTITY_REGISTRY]] as const;
  return <DocPage eyebrow="Build" title="Contracts & local SDK" description="Configured Arc Testnet deployment values and the contract surface that separates owner powers from agent payment authority." toc={toc}>
    <Section id="network" title="Arc Testnet"><p>Chain ID <code className="font-mono text-text">{CHAIN_ID}</code>. The values below are the deployment addresses configured in this application; inspect each address in Arcscan before relying on a deployment.</p><div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface-raised">{addresses.map(([label,address]) => <div key={label} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><span className="text-sm">{label}</span><a href={addressUrl(address)} target="_blank" rel="noreferrer" className="break-all font-mono text-xs text-accent hover:underline">{address}</a></div>)}</div></Section>
    <Section id="vault" title="Vault interface"><div className="grid gap-3 sm:grid-cols-2">{[['Agent','pay(to, amount, actionType)'],['Owner','setRules, pause, unpause, withdraw, rotateAgentKey'],['Public reads','owner, agentKey, caps, allowedActions, balance'],['Public upkeep','sweepIdle (funds can only go to configured treasury)']].map(([role, functions]) => <div key={role} className="rounded-xl border border-line bg-surface-raised p-4"><p className="text-xs font-bold uppercase tracking-wide text-accent">{role}</p><p className="mt-2 font-mono text-xs leading-6 text-text">{functions}</p></div>)}</div></Section>
    <Section id="sdk" title="Local monorepo SDK"><Callout tone="warning" title="Not documented as a public npm release">The SDK packages currently live in this repository. Use them as workspace packages or build them locally; do not assume a registry package exists.</Callout><CodeBlock label="workspace" code={`git clone https://github.com/CryptoZephyr/Peribolos.git
cd Peribolos
npm install
npm run build:sdk

# workspace packages
# @peribolos/core
# @peribolos/langchain`} /></Section>
  </DocPage>;
}
