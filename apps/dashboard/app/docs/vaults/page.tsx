import type { Metadata } from "next";
import { CodeBlock } from "../CodeBlock";
import { DocPage, Section, Callout, Endpoint } from "../_components/DocPage";

export const metadata: Metadata = { title: "Vault operations" };
const toc = [{ id: "states", label: "Offline and live" }, { id: "rules", label: "Rules and pause" }, { id: "funding", label: "Funding" }, { id: "rotation", label: "Signer rotation" }, { id: "revocation", label: "Revocation" }];

export default function VaultsDocsPage() {
  return <DocPage eyebrow="Build" title="Vault operations" description="Know which controls are local policy simulation and which require an owner-signed Arc transaction." toc={toc}>
    <Section id="states" title="Offline and live"><p>Every new agent starts with an offline vault record. Offline mode supports policy preflight and security simulations but never reports an on-chain payment as executed. A vault becomes live only after Peribolos verifies the deployed contract and its agent key.</p><Callout tone="success" title="Live state is chain-authoritative">The dashboard reads owner, balance, signer, expiry, pause, caps, retained float, and action bitmap from Arc. It does not let a database edit masquerade as a contract rule change.</Callout></Section>
    <Section id="rules" title="Rules and pause"><p>For a live vault, connect the owner wallet on the Vaults page. <strong className="font-semibold text-text">Update rules on Arc</strong> calls <code className="font-mono text-text">setRules</code>; Pause and Unpause call the contract directly. After receipt confirmation, the app invokes:</p><Endpoint method="POST" path="/v1/vaults/:id/sync" description="Refresh the workspace mirror from the authoritative Arc contract. It accepts no client-supplied rule values." /></Section>
    <Section id="funding" title="Funding"><p>Arc Testnet uses native USDC for value transfers. The dashboard sends value from the connected wallet to the vault, then records the event only after verifying receipt status, recipient, sender, and amount.</p><Endpoint method="POST" path="/v1/vaults/:id/fund" description="Verify and record an already-mined funding transaction. This endpoint does not move funds." /></Section>
    <Section id="rotation" title="Signer rotation"><p>Live rotation is deliberately two-phase:</p><ol className="list-decimal space-y-2 pl-5"><li><code className="font-mono text-text">/signers/rotate/prepare</code> provisions one pending managed signer.</li><li>The connected owner calls <code className="font-mono text-text">rotateAgentKey(newSigner, expiry)</code>.</li><li><code className="font-mono text-text">/signers/rotate/confirm</code> verifies the transaction targeted this vault, emitted <code className="font-mono text-text">AgentKeyRotated</code> for that signer, and matches current contract authorization before promotion.</li></ol><CodeBlock label="confirmation body" code={`{
  "vaultId": "v_…",
  "agentId": "ag_…",
  "newSignerAddress": "0x…",
  "txHash": "0x…"
}`} /></Section>
    <Section id="revocation" title="Hosted signer revocation"><Callout tone="warning" title="Revocation is not an on-chain pause">Revoking the managed signer stops Peribolos from using it. If the vault is live, the contract still recognizes that address until the owner pauses the vault or rotates its agent key. The API reports this owner action explicitly.</Callout></Section>
  </DocPage>;
}
