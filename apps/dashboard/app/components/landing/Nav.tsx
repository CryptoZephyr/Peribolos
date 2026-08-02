import Link from "next/link";
import { LandingBrand } from "./LandingBrand";

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface-raised/90 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between px-5 sm:px-8">
        <Link href="/" className="transition-opacity hover:opacity-90">
          <LandingBrand />
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-5 sm:gap-8">
          <a
            href="#product"
            className="hidden text-sm text-text-muted transition-colors hover:text-text sm:inline"
          >
            Product
          </a>
          <a
            href="#how"
            className="hidden text-sm text-text-muted transition-colors hover:text-text sm:inline"
          >
            How it works
          </a>
          <a
            href="https://docs.arc.network"
            target="_blank"
            rel="noreferrer"
            className="hidden text-sm text-text-muted transition-colors hover:text-text sm:inline"
          >
            Arc docs
          </a>
          <Link
            href="/login"
            className="rounded-lg bg-text px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-accent"
          >
            Open app
          </Link>
        </nav>
      </div>
    </header>
  );
}
