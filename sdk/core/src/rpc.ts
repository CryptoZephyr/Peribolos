/**
 * Arc testnet HTTP transport with failover + public-RPC-friendly defaults.
 *
 * Public endpoints return "request limit reached" under parallel eth_call.
 * We batch, backoff, and fall through a short list of documented endpoints.
 * Prefer NEXT_PUBLIC_RPC_URL / RPC_URL (Alchemy etc.) for demos.
 */

import { fallback, http, type Transport } from "viem";
import { ARC_TESTNET } from "./constants.js";

/** Documented Arc testnet HTTP RPCs (primary + partners). Order = preference. */
export const ARC_TESTNET_RPC_URLS = [
  ARC_TESTNET.rpcUrl, // https://rpc.testnet.arc.network
  "https://rpc.drpc.testnet.arc.network",
  "https://rpc.quicknode.testnet.arc.network",
] as const;

export type CreateArcTransportOptions = {
  /** Preferred RPC (env override). Tried first. */
  rpcUrl?: string;
  /** Extra fallbacks after the preferred URL. */
  fallbacks?: string[];
};

function uniqueUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const t = u.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/**
 * Build a viem transport that survives public Arc RPC rate limits better than
 * a single bare `http()`.
 */
export function createArcTransport(opts: CreateArcTransportOptions | string = {}): Transport {
  const options: CreateArcTransportOptions =
    typeof opts === "string" ? { rpcUrl: opts } : opts;

  const urls = uniqueUrls([
    options.rpcUrl ?? "",
    process.env.RPC_URL ?? "",
    process.env.NEXT_PUBLIC_RPC_URL ?? "",
    ...ARC_TESTNET_RPC_URLS,
    ...(options.fallbacks ?? []),
  ]);

  const transports = urls.map((url) =>
    http(url, {
      // Collapse concurrent eth_* into fewer HTTP round-trips.
      batch: { batchSize: 12, wait: 50 },
      // Public RPCs flake — retry with backoff before falling over.
      retryCount: 4,
      retryDelay: 1_500,
      timeout: 30_000,
    }),
  );

  if (transports.length === 1) return transports[0]!;

  return fallback(transports, {
    // Don't rank by latency on cold start — first healthy wins after failures.
    rank: false,
    retryCount: 2,
    retryDelay: 800,
  });
}

/** Resolve the primary URL string (for GatewayClient / logs). */
export function resolveArcRpcUrl(override?: string): string {
  return (
    override?.trim() ||
    process.env.RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_RPC_URL?.trim() ||
    ARC_TESTNET.rpcUrl
  );
}
