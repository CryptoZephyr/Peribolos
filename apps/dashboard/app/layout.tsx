import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://peribolos.io"),
  title: {
    default: "Peribolos — Smart Contract Spending Walls for AI Agents on Arc",
    template: "%s | Peribolos",
  },
  description:
    "Rule-enforced USDC smart vaults for autonomous AI agents. Non-custodial budget caps, recipient allowlists, and contract-enforced protection on Arc Testnet.",
  keywords: [
    "AI Agent Security",
    "Smart Contract Vault",
    "Arc Network",
    "Circle DCW",
    "USDC Payments",
    "Prompt Injection Protection",
    "Non-custodial Wallet Policy",
  ],
  authors: [{ name: "Peribolos Security Team" }],
  openGraph: {
    title: "Peribolos — Smart Contract Spending Walls for AI Agents",
    description:
      "Rule-enforced USDC vaults for AI agents. Prompt injection can fool the model; it cannot cross the wall.",
    url: "https://peribolos.io",
    siteName: "Peribolos",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Peribolos — Smart Contract Spending Walls for AI Agents",
    description:
      "Rule-enforced USDC vaults for AI agents. Prompt injection can fool the model; it cannot cross the wall.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-lg focus:bg-slate-900 focus:px-4 focus:py-2.5 focus:text-xs focus:font-semibold focus:text-white focus:shadow-lg"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
