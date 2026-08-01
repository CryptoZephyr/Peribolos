import Link from "next/link";
import { FACTORY_ADDRESS, addressUrl } from "@/lib/chain";
import { LandingBrand } from "./LandingBrand";

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface-raised px-5 py-10 sm:px-8">
      <div className="mx-auto flex max-w-[1240px] flex-col items-start justify-between gap-4 text-sm text-text-faint sm:flex-row sm:items-center">
        <LandingBrand />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <a
            href={addressUrl(FACTORY_ADDRESS)}
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-text"
          >
            Factory contract
          </a>
          <Link href="/docs" className="transition-colors hover:text-text">
            SDK docs
          </Link>
          <Link href="/education" className="transition-colors hover:text-text">
            Education Center
          </Link>
          <span>Built on Arc testnet</span>
        </div>
      </div>
    </footer>
  );
}
