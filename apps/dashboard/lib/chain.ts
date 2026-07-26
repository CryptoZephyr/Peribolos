/**
 * Shared Arc-testnet chain + client config for the dashboard.
 * Single source of truth — landing and app surfaces both import from here.
 *
 * Public RPC rate-limits under parallel eth_call. Transport uses failover
 * across Arc-documented endpoints + batching + retries. Prefer
 * NEXT_PUBLIC_RPC_URL (managed) for stage demos.
 */
import { createPublicClient, type Chain } from "viem";
import {
  arcTestnet,
  ARC_TESTNET,
  IDENTITY_REGISTRY_ADDRESS,
  PERIBOLOS_FACTORY_ADDRESS,
  USDC_ADDRESS,
  createArcTransport,
  resolveArcRpcUrl,
} from "@peribolos/core";

export const chain: Chain = arcTestnet;

export const FACTORY_ADDRESS = PERIBOLOS_FACTORY_ADDRESS;
export const USDC = USDC_ADDRESS;
export const IDENTITY_REGISTRY = IDENTITY_REGISTRY_ADDRESS;
export const EXPLORER = ARC_TESTNET.explorer;
export const CHAIN_ID = ARC_TESTNET.id;

/**
 * Funding helpers. The Circle Faucet dispenses Arc-testnet USDC directly (this
 * is both gas and vault balance on Arc). Bringing USDC from another chain is a
 * CCTP flow documented in the Arc App Kit bridge guide.
 */
export const FAUCET_URL = "https://faucet.circle.com";
export const BRIDGE_DOCS_URL = "https://docs.arc.network/app-kit/bridge";

/** Primary RPC string (for display / wallet transport). */
export const rpcUrl = resolveArcRpcUrl(process.env.NEXT_PUBLIC_RPC_URL);

/** Failover transport shared by read client + wagmi. */
export const arcTransport = createArcTransport({
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL,
});

/** The public, read-only client used for all chain reads (feeds, balances). */
export const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: arcTransport,
});

export function txUrl(hash: string): string {
  return `${EXPLORER}/tx/${hash}`;
}
export function addressUrl(address: string): string {
  return `${EXPLORER}/address/${address}`;
}

/** Format 6-decimal USDC base units as a human string, e.g. 1500000n -> "1.50". */
export function formatUsdc(base: bigint, maxFractionDigits = 2): string {
  const negative = base < 0n;
  const abs = negative ? -base : base;
  const whole = abs / 1_000_000n;
  const frac = (abs % 1_000_000n).toString().padStart(6, "0").slice(0, maxFractionDigits);
  const trimmed = frac.replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${trimmed ? "." + trimmed : ""}`;
}

/** Shorten an address for display: 0x1234…abcd */
export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
