import Link from "next/link";
import { Nav } from "../components/landing/Nav";
import { Footer } from "../components/landing/Footer";
import { ShieldCheck } from "@phosphor-icons/react/dist/ssr";

export const metadata = {
  title: "Privacy Policy | Peribolos",
  description: "Learn how Peribolos handles data privacy, smart vault policies, and agent telemetry.",
};

export default function PrivacyPage() {
  return (
    <>
      <Nav />
      <main id="main-content" className="min-h-[100dvh] bg-surface pt-28 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-10">
          {/* Header */}
          <div className="border-b border-line pb-8">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
              <ShieldCheck size={16} weight="bold" />
              <span>Legal & Governance</span>
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-text sm:text-4xl">Privacy Policy</h1>
            <p className="mt-2 text-sm text-text-muted">
              Effective Date: August 1, 2026 (Arc Testnet Edition)
            </p>
          </div>

          {/* Content */}
          <article className="prose prose-slate max-w-none text-sm leading-relaxed text-text-muted space-y-8">
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-text">1. Overview & custody model</h2>
              <p>
                Peribolos (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) provides smart contract-enforced vault policy software for autonomous AI agents on the Arc Blockchain Network. Owners retain control of vault assets and owner-authorized contract actions. For hosted agent execution, Circle Developer-Controlled Wallets manage agent signing keys server-side; those keys are not exposed to the browser. We collect only the technical credentials and workspace records needed to operate the service.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-text">2. Data We Collect</h2>
              <ul className="list-disc pl-5 space-y-2 text-text-muted">
                <li>
                  <strong className="text-text">Workspace Authentication:</strong> When you log in via Supabase Auth (email magic link, Web3 SIWE, or Passkey), we store your email address or wallet address solely to associate your policy rules and vaults with your account.
                </li>
                <li>
                  <strong className="text-text">On-Chain Policy Telemetry:</strong> Public blockchain addresses, transaction hashes, smart vault policy parameters (daily budget caps, allowlisted payees, rate limits), and rule enforcement audit records are stored on public ledgers and indexers.
                </li>
                <li>
                  <strong className="text-text">API & Developer Logs:</strong> Standard request metadata (IP addresses, user agent header, API key identifiers) are logged for security, rate-limiting, and abuse prevention.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-text">3. How We Use Data</h2>
              <p>We use collected metadata strictly for:</p>
              <ul className="list-disc pl-5 space-y-2 text-text-muted">
                <li>Verifying authorization for agent vault policy configuration changes.</li>
                <li>Enforcing spending boundaries and displaying activity logs in your workspace.</li>
                <li>Preventing malicious prompt injection drains and unauthorized payment attempts.</li>
                <li>Maintaining system security, uptime, and Arc Testnet smart contract synchronization.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-text">4. Circle DCW & Third-Party Services</h2>
              <p>
                Peribolos integrates with Circle Developer-Controlled Wallets (DCW) and Supabase Authentication. When you provision an agent, Circle DCW manages agent signing keys server-side under strict hardware security module (HSM) controls. Please review Circle&apos;s and Supabase&apos;s respective privacy policies for details on their data handling standards.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-text">5. Data Retention & Security</h2>
              <p>
                Policy rule configurations and audit logs are retained for the active lifecycle of your workspace. Because blockchain transactions are permanent and immutable by nature, on-chain execution records recorded on the Arc Blockchain cannot be altered or deleted.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-text">6. Contact & Data Inquiries</h2>
              <p>
                If you have questions regarding this Privacy Policy or wish to request workspace data deletion, please contact our security team at{" "}
                <a href="mailto:security@peribolos.io" className="font-medium text-accent hover:underline">
                  security@peribolos.io
                </a>
                .
              </p>
            </section>
          </article>

          <div className="pt-6 border-t border-line flex items-center justify-between text-xs text-text-muted">
            <Link href="/terms" className="hover:text-text underline">
              View Terms of Service
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
