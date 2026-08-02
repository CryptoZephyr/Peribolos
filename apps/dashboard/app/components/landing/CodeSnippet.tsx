import { Reveal } from "./Reveal";

const SNIPPET = `import { createPeribolosTools } from "@peribolos/langchain";

const tools = createPeribolosTools({
  vaultAddress: process.env.PERIBOLOS_VAULT_ADDRESS,
  // Primary path: PERIBOLOS_API_KEY (pb_live_...) keeps agent private keys server-side
  apiKey: process.env.PERIBOLOS_API_KEY,
});

// peribolos_pay · peribolos_buy · peribolos_status
model.bindTools(tools);`;

export function CodeSnippet() {
  return (
    <section className="border-t border-line bg-[#fbfcfd] px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto grid max-w-[1240px] gap-10 md:grid-cols-2 md:items-center">
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
          <pre className="overflow-x-auto rounded-2xl border border-line bg-text p-6 font-mono text-[13px] leading-relaxed text-slate-300 shadow-[0_16px_36px_rgba(16,24,40,0.12)]">
            <code>{SNIPPET}</code>
          </pre>
        </Reveal>
      </div>
    </section>
  );
}
