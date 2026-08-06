import Link from "next/link";
import { Nav } from "../components/landing/Nav";
import { Footer } from "../components/landing/Footer";
import { LockKey } from "@phosphor-icons/react/dist/ssr";

export const metadata = {
  title: "Terms of Service | Peribolos",
  description: "Terms of Service governing the use of Peribolos smart vault policies on Arc.",
};

export default function TermsPage() {
  return (
    <>
      <Nav />
      <main id="main-content" className="min-h-[100dvh] bg-surface pt-28 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-10">
          {/* Header */}
          <div className="border-b border-line pb-8">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
              <LockKey size={16} weight="bold" />
              <span>Legal & Governance</span>
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-text sm:text-4xl">Terms of Service</h1>
            <p className="mt-2 text-sm text-text-muted">
              Effective Date: August 1, 2026 (Arc Testnet Edition)
            </p>
          </div>

          {/* Content */}
          <article className="prose prose-slate max-w-none text-sm leading-relaxed text-text-muted space-y-8">
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-text">1. Acceptance of Terms</h2>
              <p>
                By accessing or using Peribolos (the &quot;Platform&quot;, &quot;Service&quot;, or &quot;Smart Contracts&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, you must not access or use the Platform.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-text">2. Smart vault and signer model</h2>
              <p>
                Peribolos provides smart contract software deployed on the Arc Blockchain Network. You retain control over vault assets and owner-authorized changes. The hosted agent path uses Circle Developer-Controlled Wallets to manage agent signing keys server-side; those keys are not held in the browser. The Platform executes spending constraints (daily caps, per-tx caps, recipient allowlists) directly via smart contract bytecode.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-text">3. Autonomous Agent Security & User Responsibilities</h2>
              <p>You are solely responsible for:</p>
              <ul className="list-disc pl-5 space-y-2 text-text-muted">
                <li>Configuring appropriate budget limits, allowlisted payees, and signer rotations for your AI agents.</li>
                <li>Safeguarding your workspace authentication credentials and API keys (`pb_live_...`).</li>
                <li>Reviewing all policy rules and simulation reports prior to deploying live agent wallets.</li>
                <li>Ensuring your use of autonomous AI agents complies with applicable laws and financial regulations.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-text">4. Testnet & Smart Contract Disclaimers</h2>
              <p>
                Peribolos is currently deployed on the Arc Testnet. Testnet assets carry no monetary value. While smart contract rules are mathematically enforced on-chain, software is provided &quot;AS IS&quot; without warranties of any kind. You acknowledge the inherent risks associated with experimental blockchain technology and AI agent tool usage.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-text">5. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by law, Peribolos, its developers, and contributors shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of funds, unauthorized agent transactions, or service interruptions resulting from prompt injection or model error.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-text">6. Modifications & Governing Law</h2>
              <p>
                We reserve the right to update these Terms at any time. Continued use of the Platform after changes are published constitutes acceptance of the revised Terms.
              </p>
            </section>
          </article>

          <div className="pt-6 border-t border-line flex items-center justify-between text-xs text-text-muted">
            <Link href="/privacy" className="hover:text-text underline">
              View Privacy Policy
            </Link>
            <Link href="/app" className="font-semibold text-accent hover:underline">
              Return to Workspace →
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
