import type { Metadata } from "next";
import { DocsShell } from "./_components/DocsShell";

export const metadata: Metadata = {
  title: { default: "Peribolos Docs", template: "%s · Peribolos Docs" },
  description: "Build Arc Testnet agents that can propose payments without bypassing owner-defined vault rules.",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <DocsShell>{children}</DocsShell>;
}
