import { Reveal } from "./Reveal";

const SNIPPET = `import { createPeribolosTools } from "@peribolos/langchain";

const tools = createPeribolosTools({
  vaultAddress: "0x62D5487d...9BbC7B",
  // Primary path: PERIBOLOS_API_KEY (pb_live_...) — agent private keys stay server-side
  apiKey: process.env.PERIBOLOS_API_KEY,
});

// peribolos_pay · peribolos_buy · peribolos_status
model.bindTools(tools);`;

export function CodeSnippet() {
  return (
    <section className="border-t border-line px-6 py-24 sm:py-32">
      <div className="mx-auto grid max-w-[1200px] gap-10 md:grid-cols-2 md:items-center">
        <Reveal>
          <h2 className="text-3xl font-medium leading-tight tracking-tight text-text sm:text-4xl">
            Ten lines, not a rewrite.
          </h2>
          <p className="mt-5 max-w-md leading-relaxed text-text-muted">
            Wrap an existing LangChain agent with three tools: pay, buy, and
            status. Every payment call is checked by the vault contract
            before anything moves.
          </p>
        </Reveal>

        <Reveal>
          <pre className="overflow-x-auto rounded-[12px] border border-line bg-surface-raised p-6 font-mono text-[13px] leading-relaxed text-text-muted">
            <code>{SNIPPET}</code>
          </pre>
        </Reveal>
      </div>
    </section>
  );
}
