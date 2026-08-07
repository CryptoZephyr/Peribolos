import type { Metadata } from "next";
import { CodeBlock } from "../CodeBlock";
import { DocPage, Section, Endpoint, Callout } from "../_components/DocPage";

export const metadata: Metadata = { title: "Payment API" };
const toc = [{ id: "request", label: "Request" }, { id: "response", label: "Response" }, { id: "idempotency", label: "Idempotency" }, { id: "reasons", label: "Block reasons" }];

export default function PaymentApiPage() {
  return <DocPage eyebrow="Build" title="Hosted payment API" description="A framework-neutral endpoint for protected Arc payments. Authenticate with the agent key returned at provisioning." toc={toc}>
    <Section id="request" title="Request">
      <Endpoint method="POST" path="/v1/payments" description="Submit a payment proposal for the vault assigned to the authenticated agent." />
      <CodeBlock label="JSON body" code={`{
  "payeeAddress": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "amountUsdc": 1.5,
  "actionType": 1,
  "idempotencyKey": "order-123"
}`} />
      <p><code className="font-mono text-text">amountUsdc</code> is positive and supports at most six decimal places. <code className="font-mono text-text">actionType</code> is an integer from 0–255 whose corresponding bit must be enabled by the vault.</p>
    </Section>
    <Section id="response" title="Response">
      <CodeBlock label="example" code={`{
  "id": "pr_…",
  "status": "BLOCKED",
  "amountUsdc": 1.5,
  "payeeAddress": "0x…",
  "blockReasonCode": "RECIPIENT_NOT_ALLOWLISTED",
  "blockReasonDescription": "The destination is not approved by this vault.",
  "txHash": "0x…",
  "explorerUrl": "https://testnet.arcscan.app/tx/0x…"
}`} />
      <Callout title="A 2xx response is not automatically a transfer">Always branch on <code className="font-mono text-text">status</code>. A policy-blocked on-chain attempt may be a confirmed transaction that moved zero funds.</Callout>
    </Section>
    <Section id="idempotency" title="Idempotency"><p>Send a stable key for each logical purchase. Repeating the same key in the same workspace returns the stored result instead of initiating another payment. Keep keys non-empty and under 200 characters.</p></Section>
    <Section id="reasons" title="Common block reasons"><div className="space-y-2">{[['VAULT_PAUSED','The owner has paused payments.'],['AGENT_KEY_EXPIRED','The authorized agent key has expired.'],['RECIPIENT_NOT_ALLOWLISTED','The destination is not approved.'],['ACTION_NOT_ALLOWED','The action bit is disabled.'],['PER_TX_CAP_EXCEEDED','The request is larger than the per-payment cap.'],['DAILY_CAP_EXCEEDED','The UTC-day allowance is exhausted.'],['INSUFFICIENT_BALANCE','The vault cannot cover the request.']].map(([code, text]) => <div key={code} className="grid gap-1 border-b border-line py-3 sm:grid-cols-[230px_1fr]"><code className="font-mono text-xs text-blocked">{code}</code><span className="text-sm">{text}</span></div>)}</div></Section>
  </DocPage>;
}
