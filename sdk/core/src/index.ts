/**
 * @peribolos/core — TypeScript client for Peribolos vaults on Arc.
 *
 * Two capabilities, mirroring the two trust tiers:
 *   - Vault tier   (rule-enforced): PeribolosVaultClient.pay(...)
 *   - Petty-cash tier (x402, gasless): PeribolosVaultClient.buy(url)
 *
 * This file declares the PUBLIC SURFACE. Method bodies are implemented in
 * ./client.ts (see IMPLEMENTATION CONTRACT comments there). Consumers should
 * import from the package root only.
 */

export * from "./constants.js";
// DEMO_VAULT_ADDRESS is part of constants for dashboard/docs defaults.
export * from "./types.js";
export {
  PeribolosVaultClient,
  usdc,
  createArcTransport,
  createPettyCashGateway,
  DEFAULT_ACTIVITY_LOOKBACK_BLOCKS,
  resolveArcRpcUrl,
  ARC_TESTNET_RPC_URLS,
} from "./client.js";
export type { PeribolosVaultClientConfig } from "./client.js";
export { PeribolosFactoryClient } from "./factory.js";
export type { PeribolosFactoryClientConfig } from "./factory.js";
export { PeribolosHostedClient } from "./hosted.js";
export type { PeribolosHostedClientConfig, HostedPaymentParams, HostedPaymentResult } from "./hosted.js";

