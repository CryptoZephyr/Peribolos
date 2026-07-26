"use client";

/**
 * Read-only chain data hooks for the dashboard. No wallet/private key is ever
 * required here: everything goes through the shared read-only `publicClient`
 * from @/lib/chain plus the vault/factory ABIs exported by @peribolos/core.
 * Owner writes (pause/unpause/sweep) live in OwnerControls.tsx via wagmi's
 * useWriteContract, signed by the connected wallet.
 */
import { useQuery } from "@tanstack/react-query";
import { decodeEventLog, type Address, type Hex } from "viem";
import { ActionType, BlockReason, PERIBOLOS_FACTORY_ADDRESS } from "@peribolos/core";
import vaultAbiJson from "@peribolos/core/abi/PeribolosVault.json";
import factoryAbiJson from "@peribolos/core/abi/PeribolosFactory.json";
import { publicClient, USDC } from "@/lib/chain";

export const vaultAbi = ((vaultAbiJson as { abi?: unknown }).abi ?? vaultAbiJson) as never;
export const factoryAbi = ((factoryAbiJson as { abi?: unknown }).abi ?? factoryAbiJson) as never;

const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

/** Verified demo vault on Arc testnet with real executed + blocked history (v3.1 redeploy). */
export const DEMO_VAULT_ADDRESS: Address = "0x62D5487d6523fc4D34692e1DbF8EBC01F39BbC7B";

export interface VaultStateData {
  address: Address;
  owner: Address;
  treasury: Address;
  agentKey: Address;
  agentExpiry: bigint;
  paused: boolean;
  identityRegistered: boolean;
  perTxCap: bigint;
  dailyCap: bigint;
  floatAmount: bigint;
  allowedActions: bigint;
  epochSpent: bigint;
  balance: bigint;
}

async function fetchVaultState(vaultAddress: Address): Promise<VaultStateData> {
  // One multicall instead of 12 parallel eth_call — public Arc RPC rate-limits hard.
  const results = await publicClient.multicall({
    allowFailure: false,
    contracts: [
      { address: vaultAddress, abi: vaultAbi, functionName: "owner" },
      { address: vaultAddress, abi: vaultAbi, functionName: "treasury" },
      { address: vaultAddress, abi: vaultAbi, functionName: "agentKey" },
      { address: vaultAddress, abi: vaultAbi, functionName: "agentExpiry" },
      { address: vaultAddress, abi: vaultAbi, functionName: "paused" },
      { address: vaultAddress, abi: vaultAbi, functionName: "identityRegistered" },
      { address: vaultAddress, abi: vaultAbi, functionName: "perTxCap" },
      { address: vaultAddress, abi: vaultAbi, functionName: "dailyCap" },
      { address: vaultAddress, abi: vaultAbi, functionName: "floatAmount" },
      { address: vaultAddress, abi: vaultAbi, functionName: "allowedActions" },
      { address: vaultAddress, abi: vaultAbi, functionName: "epochSpent" },
      { address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [vaultAddress] },
    ],
  });

  const [
    owner,
    treasury,
    agentKey,
    agentExpiry,
    paused,
    identityRegistered,
    perTxCap,
    dailyCap,
    floatAmount,
    allowedActions,
    epochSpent,
    balance,
  ] = results as [
    Address,
    Address,
    Address,
    bigint,
    boolean,
    boolean,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
  ];

  return {
    address: vaultAddress,
    owner,
    treasury,
    agentKey,
    agentExpiry: BigInt(agentExpiry),
    paused,
    identityRegistered,
    perTxCap: BigInt(perTxCap),
    dailyCap: BigInt(dailyCap),
    floatAmount: BigInt(floatAmount),
    allowedActions: BigInt(allowedActions),
    epochSpent: BigInt(epochSpent),
    balance: BigInt(balance),
  };
}

export function useVaultState(vaultAddress: Address | undefined) {
  return useQuery({
    queryKey: ["vaultState", vaultAddress],
    queryFn: () => fetchVaultState(vaultAddress as Address),
    enabled: Boolean(vaultAddress),
    // Live enough for demo; 12s poll to spare public Arc RPC rate limits.
    refetchInterval: 12_000,
    staleTime: 8_000,
    retry: 4,
    retryDelay: (i) => Math.min(1_500 * 2 ** i, 12_000),
  });
}

export interface ActivityRowData {
  kind: "executed" | "blocked";
  to: Address;
  amount: bigint;
  actionType: ActionType;
  reason?: BlockReason;
  txHash: Hex;
  blockNumber: bigint;
  timestamp?: bigint;
}

const blockTimestampCache = new Map<bigint, bigint>();

async function fetchActivity(vaultAddress: Address): Promise<ActivityRowData[]> {
  const currentBlock = await publicClient.getBlockNumber();
  // ~2–3k blocks is enough history for demo vaults and stays under public RPC getLogs caps.
  const fromBlock = currentBlock > 3000n ? currentBlock - 3000n : 0n;

  const logs = await publicClient.getLogs({
    address: vaultAddress,
    fromBlock,
    toBlock: "latest",
  });

  const events: ActivityRowData[] = [];
  for (const log of logs) {
    let decoded: { eventName: string; args: unknown };
    try {
      decoded = decodeEventLog({
        abi: vaultAbi,
        data: log.data,
        topics: log.topics,
      }) as { eventName: string; args: unknown };
    } catch {
      continue;
    }

    if (decoded.eventName === "PaymentExecuted") {
      const args = decoded.args as { to: Address; amount: bigint; actionType: number };
      events.push({
        kind: "executed",
        to: args.to,
        amount: args.amount,
        actionType: args.actionType as ActionType,
        txHash: log.transactionHash as Hex,
        blockNumber: log.blockNumber as bigint,
      });
    } else if (decoded.eventName === "PaymentBlocked") {
      const args = decoded.args as {
        to: Address;
        amount: bigint;
        actionType: number;
        reason: number;
      };
      events.push({
        kind: "blocked",
        to: args.to,
        amount: args.amount,
        actionType: args.actionType as ActionType,
        reason: args.reason as BlockReason,
        txHash: log.transactionHash as Hex,
        blockNumber: log.blockNumber as bigint,
      });
    }
  }

  events.sort((a, b) => (a.blockNumber < b.blockNumber ? 1 : a.blockNumber > b.blockNumber ? -1 : 0));

  // Timestamps for the 12 newest only — enough for UI, avoids RPC storms.
  const recentEvents = events.slice(0, 12);
  const uniqueBlocks = Array.from(new Set(recentEvents.map((e) => e.blockNumber)));
  const uncachedBlocks = uniqueBlocks.filter((blockNumber) => !blockTimestampCache.has(blockNumber));

  if (uncachedBlocks.length > 0) {
    for (const blockNumber of uncachedBlocks) {
      try {
        const block = await publicClient.getBlock({ blockNumber });
        blockTimestampCache.set(blockNumber, block.timestamp);
      } catch {
        // Timestamp is a display nicety; block number alone is still shown.
      }
      // Brief pause between eth_getBlockByNumber on the public endpoint.
      await new Promise((r) => setTimeout(r, 80));
    }
  }

  return events.map((e) => ({ ...e, timestamp: blockTimestampCache.get(e.blockNumber) }));
}

export function useVaultActivity(vaultAddress: Address | undefined) {
  return useQuery({
    queryKey: ["vaultActivity", vaultAddress],
    queryFn: () => fetchActivity(vaultAddress as Address),
    enabled: Boolean(vaultAddress),
    // 12s poll — playground blocks land without manual refresh; spare public RPC.
    refetchInterval: 12_000,
    staleTime: 8_000,
    retry: 4,
    retryDelay: (i) => Math.min(1_500 * 2 ** i, 12_000),
  });
}

async function fetchOwnerDomains(owner: Address): Promise<Address[]> {
  return publicClient.readContract({
    address: PERIBOLOS_FACTORY_ADDRESS,
    abi: factoryAbi,
    functionName: "domainsOf",
    args: [owner],
  }) as Promise<Address[]>;
}

export function useOwnerDomains(owner: Address | undefined) {
  return useQuery({
    queryKey: ["ownerDomains", owner],
    queryFn: () => fetchOwnerDomains(owner as Address),
    enabled: Boolean(owner),
  });
}
