"use client";

import React, { useState } from "react";

export function ExplorerBadge({
  type,
  hashOrAddress,
  label,
}: {
  type: "tx" | "address";
  hashOrAddress: string;
  label?: string;
}) {
  const url = `https://testnet.arcscan.app/${type}/${hashOrAddress}`;
  const truncated =
    hashOrAddress.length > 16
      ? `${hashOrAddress.substring(0, 6)}...${hashOrAddress.substring(hashOrAddress.length - 4)}`
      : hashOrAddress;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded border border-accent/20 bg-accent/10 px-2 py-0.5 font-mono text-[10px] font-medium text-accent transition-colors hover:border-accent/40 hover:bg-accent/20"
      title={`View ${type === "tx" ? "transaction" : "address"} on Arcscan`}
    >
      <span>{label || truncated}</span>
      <span className="text-[9px]">↗</span>
    </a>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard fallback
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded border border-line bg-surface px-2 py-0.5 text-[11px] font-medium text-text-muted hover:text-text hover:bg-surface-raised transition-colors"
      title="Copy to clipboard"
    >
      <span>{copied ? "Copied!" : label}</span>
    </button>
  );
}
