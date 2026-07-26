import { Reveal } from "./Reveal";

const POINTS = [
  {
    index: "01",
    title: "On-chain enforcement",
    body: "The allowlist and caps are contract state, not application logic. Nothing server-side can be tricked, because there is no server in the loop.",
  },
  {
    index: "02",
    title: "No backend to breach",
    body: "The dashboard is a static export that reads chain events directly. No database, no user table, no API server to leak.",
  },
  {
    index: "03",
    title: "ERC-8004 identity",
    body: "Every vault mints the agent an on-chain identity NFT at creation, so who is spending is verifiable, not just claimed by the client.",
  },
  {
    index: "04",
    title: "Ten-line SDK",
    body: "createPeribolosTools() drops three tools into an existing LangChain agent. No rewrite, no new infrastructure to run.",
  },
];

export function Defensible() {
  return (
    <section className="border-t border-line px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-[1200px]">
        <Reveal>
          <h2 className="max-w-xl text-3xl font-medium leading-tight tracking-tight text-text sm:text-4xl">
            What makes it hard to argue with.
          </h2>
        </Reveal>

        <div className="mt-14 max-w-3xl">
          {POINTS.map((point) => (
            <Reveal key={point.index}>
              <div className="grid grid-cols-[3.5rem_1fr] gap-6 border-t border-line py-8 first:border-t-0 sm:grid-cols-[5rem_1fr]">
                <span className="font-mono text-sm text-text-faint">
                  {point.index}
                </span>
                <div>
                  <h3 className="text-lg font-medium text-text">
                    {point.title}
                  </h3>
                  <p className="mt-2 max-w-xl leading-relaxed text-text-muted">
                    {point.body}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
