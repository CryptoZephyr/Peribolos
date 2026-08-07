import Link from "next/link";
import { ARC_DOCS_URL, FACTORY_ADDRESS, addressUrl } from "@/lib/chain";
import { LandingBrand } from "./LandingBrand";

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface-raised px-5 py-10 sm:px-8 font-sans">
      <div className="mx-auto flex max-w-[1240px] flex-col items-start justify-between gap-6 text-xs text-text-faint sm:flex-row sm:items-center">
        <LandingBrand />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-medium">
          <a
            href={addressUrl(FACTORY_ADDRESS)}
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-text"
          >
            Factory contract
          </a>
          <Link href="/docs" className="transition-colors hover:text-text">
            Peribolos docs
          </Link>
          <a href={ARC_DOCS_URL} target="_blank" rel="noreferrer" className="transition-colors hover:text-text">
            Arc docs
          </a>
          <Link href="/login" className="transition-colors hover:text-text">
            Open workspace
          </Link>
          <span className="text-text-muted">Built on Arc testnet</span>
        </div>
      </div>
    </footer>
  );
}
