/**
 * Canonical Arc testnet + Peribolos deployment constants.
 * Verified live on 2026-07-31. Chain, USDC, and the ERC-8004 registry are
 * Arc-network facts; the factory is our own deployment.
 */

import { defineChain } from "viem";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});

export const ARC_TESTNET = {
  id: 5042002,
  name: "Arc Testnet",
  rpcUrl: "https://rpc.testnet.arc.network",
  wsUrl: "wss://rpc.testnet.arc.network",
  explorer: "https://testnet.arcscan.app",
  /** Circle Gateway SDK chain name (`@circle-fin/x402-batching`). */
  gatewayChainName: "arcTestnet",
} as const;

/**
 * ERC-20 USDC interface (6 decimals). On Arc this is the SAME asset as the
 * 18-decimal native gas balance — see USDC_NATIVE_DECIMALS. All Peribolos
 * vault amounts are expressed in 6-decimal ERC-20 base units.
 */
export const USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as const;
export const USDC_ERC20_DECIMALS = 6;

export const IDENTITY_REGISTRY_ADDRESS = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as const;

/**
 * PeribolosFactory — Arc testnet (v3.2, accrued protocol-fee reserves).
 * Redeployed 2026-07-31. Previous factory: 0xda3751cd08435D8b5137DD11A9a7797c214cfC4a.
 */
export const PERIBOLOS_FACTORY_ADDRESS = "0x84B6a05B1d71D5947Adf1438c6FFe8Eb66AdA31E" as const;

/** Fresh smoke vault from 2026-07-31 redeploy (feeBps=0, funded). */
export const DEMO_VAULT_ADDRESS = "0xac5d542EdCB15972570685B2Fdb87be71d1378a1" as const;
