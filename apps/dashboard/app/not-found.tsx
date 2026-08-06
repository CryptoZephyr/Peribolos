import Link from "next/link";
import { ShieldCheck, House } from "@phosphor-icons/react/dist/ssr";
import { PeribolosLogo } from "@/app/components/PeribolosLogo";

export const metadata = {
  title: "404 Page Not Found | Peribolos",
  description: "The page or resource you are looking for does not exist in this Peribolos vault workspace.",
};

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] bg-surface flex flex-col justify-between p-6 sm:p-10 font-sans">
      <header className="flex items-center justify-between mx-auto w-full max-w-5xl">
        <Link href="/" aria-label="Peribolos home">
          <PeribolosLogo size={28} showBadge={false} />
        </Link>
        <span className="text-xs font-mono font-medium text-accent bg-accent-tint px-2.5 py-1 rounded-md border border-accent/20">
          Arc Testnet
        </span>
      </header>

      <main id="main-content" className="mx-auto my-auto max-w-lg text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-surface-raised shadow-sm text-text-muted">
          <ShieldCheck size={32} weight="bold" className="text-accent" />
        </div>

        <div className="space-y-2">
          <p className="eyebrow text-accent">Error 404 · Vault Path Not Found</p>
          <h1 className="text-3xl font-bold tracking-tight text-text sm:text-4xl">
            This route is beyond the wall.
          </h1>
          <p className="text-sm leading-relaxed text-text-muted">
            The page, agent vault, or audit resource you requested does not exist or has been moved to another policy path.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/app"
            className="flex items-center gap-2 rounded-lg bg-text px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-accent transition-all"
          >
            <House size={15} />
            Go to Dashboard
          </Link>
          <Link
            href="/docs"
            className="flex items-center gap-2 rounded-lg border border-line bg-surface-raised px-5 py-2.5 text-xs font-semibold text-text hover:border-line-strong hover:bg-surface transition-all"
          >
            SDK Documentation
          </Link>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-5xl text-center text-xs text-text-faint pt-6 border-t border-line">
        Peribolos Smart Contract Enforced Vault Protocol · Arc Network
      </footer>
    </div>
  );
}
