import type { Metadata } from "next";
import { CodeBlock } from "../CodeBlock";
import { DocPage, Section, Callout } from "../_components/DocPage";

export const metadata: Metadata = { title: "Getting started" };
const toc = [{ id: "requirements", label: "Requirements" }, { id: "provision", label: "Provision an agent" }, { id: "attach", label: "Deploy and attach" }, { id: "pay", label: "Make a payment" }];

export default function GettingStartedPage() {
  return <DocPage eyebrow="Start" title="From zero to a protected payment" description="Use the dashboard for owner actions and one small HTTP call for the agent. No agent private key belongs in your model process." toc={toc}>
    <Section id="requirements" title="Requirements"><ul className="list-disc space-y-2 pl-5"><li>A Peribolos user session for workspace administration.</li><li>An Arc Testnet browser wallet for contract-owner transactions.</li><li>Arc Testnet USDC for funding and gas.</li><li>An HTTP-capable agent runtime.</li></ul></Section>
    <Section id="provision" title="1. Provision an agent">
      <p>Create the agent first. Do not pass a pre-existing vault address: a newly provisioned signer cannot already be that vault&apos;s authorized agent key.</p>
      <CodeBlock label="request" code={`curl -X POST "$PERIBOLOS_API_URL/v1/agents" \\
  -H "Authorization: Bearer $OWNER_SESSION" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Research buyer","framework":"custom"}'`} />
      <Callout tone="warning" title="Save the key once">The response contains <code className="font-mono text-text">apiKey</code> once. Store it in your agent&apos;s secret manager; the dashboard cannot reveal it again.</Callout>
    </Section>
    <Section id="attach" title="2. Deploy and attach the live vault">
      <p>Open <strong className="font-semibold text-text">Vaults → Create & fund domain</strong>, select the offline vault, and deploy with the managed signer shown for that agent. After the owner transaction confirms, the app attaches the address and reads its owner, signer, limits, action bitmap, expiry, and pause state from Arc.</p>
      <CodeBlock label="attach by API" code={`curl -X PATCH "$PERIBOLOS_API_URL/v1/vaults/$VAULT_ID" \\
  -H "Authorization: Bearer $OWNER_SESSION" \\
  -H "Content-Type: application/json" \\
  -d '{"address":"0xYourDeployedVault","ownerAddress":"0xYourOwnerWallet"}'`} />
    </Section>
    <Section id="pay" title="3. Make a payment">
      <CodeBlock label="agent request" code={`const response = await fetch(process.env.PERIBOLOS_API_URL + "/v1/payments", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer " + process.env.PERIBOLOS_API_KEY,
  },
  body: JSON.stringify({
    payeeAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    amountUsdc: 1.5,
    actionType: 1,
    idempotencyKey: "research-order-123",
  }),
});

const payment = await response.json();
// status: EXECUTED | BLOCKED | FAILED`} />
    </Section>
  </DocPage>;
}
