/**
 * PeribolosVaultClient — the agent-side client for one Peribolos vault.
 *
 * Two payment tiers, one class:
 *   - pay(to, amount, actionType): vault tier — an on-chain call the vault's
 *     rules gate in consensus. A blocked payment is a SUCCESSFUL transaction
 *     that moved no funds and emitted PaymentBlocked(reason).
 *   - buy(url): petty-cash tier — gasless x402 Nanopayment via Circle Gateway,
 *     bounded on-chain by the Gateway deposit, not by vault rules.
 *
 * The client holds the agent key. It can call pay()/sweepIdle() and sign
 * petty-cash authorizations — nothing else; owner functions are not exposed
 * here by design (see PeribolosFactoryClient / the dashboard for those).
 */

import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  parseUnits,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  type Account,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { GatewayClient } from "@circle-fin/x402-batching/client";

import vaultAbiJson from "./abi/PeribolosVault.json" with { type: "json" };
import { ARC_TESTNET, USDC_ADDRESS, arcTestnet } from "./constants.js";
import { createArcTransport, resolveArcRpcUrl } from "./rpc.js";
import {
  ActionType,
  BlockReason,
  BlockReasonCode,
  type ActivityEvent,
  type PayResult,
  type PettyCashResult,
  type VaultState,
} from "./types.js";

export { createArcTransport, resolveArcRpcUrl, ARC_TESTNET_RPC_URLS } from "./rpc.js";
export type { CreateArcTransportOptions } from "./rpc.js";

const vaultAbi = (vaultAbiJson as { abi?: unknown }).abi ?? vaultAbiJson;

const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

/** Default activity lookback — keeps public Arc RPC getLogs under rate limits. */
export const DEFAULT_ACTIVITY_LOOKBACK_BLOCKS = 3_000n;

export interface PeribolosVaultClientConfig {
  /** The agent's PeribolosVault address (from the dashboard / createDomain). */
  vaultAddress: Address;
  /** Agent EOA private key. Vault-scoped: it can only propose payments. */
  agentPrivateKey: Hex;
  /** Override RPC (defaults to the public Arc testnet endpoint). */
  rpcUrl?: string;
  /**
   * Petty-cash (x402) configuration. Enabled by default with the agent key;
   * pass `false` to disable the tier entirely.
   */
  pettyCash?: false | { privateKey?: Hex };
}

/** Convert a human USDC string ("1.50") to 6-decimal base units. */
export function usdc(amount: string): bigint {
  return parseUnits(amount, 6);
}

/**
 * Standalone Gateway client for Arc testnet Nanopayments.
 * Use for deposits / balance checks without a full vault client.
 */
export function createPettyCashGateway(opts: {
  privateKey: Hex;
  rpcUrl?: string;
}): GatewayClient {
  return new GatewayClient({
    chain: ARC_TESTNET.gatewayChainName,
    privateKey: opts.privateKey,
    rpcUrl: resolveArcRpcUrl(opts.rpcUrl),
  });
}

export class PeribolosVaultClient {
  readonly vaultAddress: Address;
  readonly agentAddress: Address;

  private readonly account: Account;
  private readonly publicClient: PublicClient;
  private readonly walletClient: WalletClient;
  private readonly pettyCashKey: Hex | null;
  private readonly rpcUrl: string;
  private gateway: GatewayClient | null = null;

  constructor(config: PeribolosVaultClientConfig) {
    this.vaultAddress = config.vaultAddress;
    this.account = privateKeyToAccount(config.agentPrivateKey);
    this.agentAddress = this.account.address;
    this.rpcUrl = resolveArcRpcUrl(config.rpcUrl);

    const transport = createArcTransport({ rpcUrl: this.rpcUrl });
    this.publicClient = createPublicClient({ chain: arcTestnet, transport });
    this.walletClient = createWalletClient({
      chain: arcTestnet,
      transport,
      account: this.account,
    });

    if (config.pettyCash === false) {
      this.pettyCashKey = null;
    } else {
      this.pettyCashKey = config.pettyCash?.privateKey ?? config.agentPrivateKey;
    }
  }

  // -------------------------------------------------------------------------
  // Vault tier
  // -------------------------------------------------------------------------

  /**
   * Propose a payment to the vault. Never throws on a rule violation — a
   * blocked payment resolves with `executed: false` plus the on-chain reason,
   * because the block itself is a recorded, successful transaction.
   */
  async pay(
    to: Address,
    amount: bigint,
    actionType: ActionType = ActionType.SERVICE_PAYMENT,
  ): Promise<PayResult> {
    const txHash = await this.walletClient.writeContract({
      chain: arcTestnet,
      account: this.account,
      address: this.vaultAddress,
      abi: vaultAbi as never,
      functionName: "pay",
      args: [to, amount, actionType],
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== this.vaultAddress.toLowerCase()) continue;
      let decoded: { eventName: string; args: unknown };
      try {
        decoded = decodeEventLog({
          abi: vaultAbi as never,
          data: log.data,
          topics: log.topics,
        }) as { eventName: string; args: unknown };
      } catch {
        continue;
      }

      if (decoded.eventName === "PaymentExecuted") {
        const args = decoded.args as { to: Address; amount: bigint; actionType: number };
        return {
          executed: true,
          txHash,
          to: args.to,
          amount: args.amount,
          actionType: args.actionType as ActionType,
        };
      }
      if (decoded.eventName === "PaymentBlocked") {
        const args = decoded.args as {
          to: Address;
          amount: bigint;
          actionType: number;
          reason: number;
        };
        const reason = args.reason as BlockReason;
        return {
          executed: false,
          txHash,
          to: args.to,
          amount: args.amount,
          actionType: args.actionType as ActionType,
          reason,
          reasonCode: BlockReasonCode[reason] ?? `UNKNOWN_${args.reason}`,
        };
      }
    }

    throw new Error(
      `pay(): transaction ${txHash} emitted neither PaymentExecuted nor PaymentBlocked — is ${this.vaultAddress} a PeribolosVault?`,
    );
  }

  /** Trigger the permissionless idle-fund sweep to the owner's treasury. */
  async sweepIdle(): Promise<Hex> {
    const txHash = await this.walletClient.writeContract({
      chain: arcTestnet,
      account: this.account,
      address: this.vaultAddress,
      abi: vaultAbi as never,
      functionName: "sweepIdle",
      args: [],
    });
    await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  }

  /** Read the vault's full live state in one multicall (RPC-friendly). */
  async getState(): Promise<VaultState> {
    const results = await this.publicClient.multicall({
      allowFailure: true,
      contracts: [
        { address: this.vaultAddress, abi: vaultAbi as never, functionName: "owner" },
        { address: this.vaultAddress, abi: vaultAbi as never, functionName: "treasury" },
        { address: this.vaultAddress, abi: vaultAbi as never, functionName: "agentKey" },
        { address: this.vaultAddress, abi: vaultAbi as never, functionName: "agentExpiry" },
        { address: this.vaultAddress, abi: vaultAbi as never, functionName: "paused" },
        { address: this.vaultAddress, abi: vaultAbi as never, functionName: "identityRegistered" },
        { address: this.vaultAddress, abi: vaultAbi as never, functionName: "perTxCap" },
        { address: this.vaultAddress, abi: vaultAbi as never, functionName: "dailyCap" },
        { address: this.vaultAddress, abi: vaultAbi as never, functionName: "floatAmount" },
        { address: this.vaultAddress, abi: vaultAbi as never, functionName: "allowedActions" },
        { address: this.vaultAddress, abi: vaultAbi as never, functionName: "epochSpent" },
        {
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [this.vaultAddress],
        },
        // feeBps / feeRecipient exist on post-v3.1 vaults only — allowFailure.
        { address: this.vaultAddress, abi: vaultAbi as never, functionName: "feeBps" },
        { address: this.vaultAddress, abi: vaultAbi as never, functionName: "feeRecipient" },
      ],
    });

    const req = <T,>(i: number, label: string): T => {
      const r = results[i];
      if (r.status !== "success") {
        throw new Error(`getState(): failed to read ${label}`);
      }
      return r.result as T;
    };

    const feeBpsResult = results[12];
    const feeRecipientResult = results[13];

    return {
      address: this.vaultAddress,
      owner: req<Address>(0, "owner"),
      treasury: req<Address>(1, "treasury"),
      agentKey: req<Address>(2, "agentKey"),
      agentExpiry: BigInt(req<bigint>(3, "agentExpiry")),
      paused: req<boolean>(4, "paused"),
      identityRegistered: req<boolean>(5, "identityRegistered"),
      rules: {
        perTxCap: BigInt(req<bigint>(6, "perTxCap")),
        dailyCap: BigInt(req<bigint>(7, "dailyCap")),
        floatAmount: BigInt(req<bigint>(8, "floatAmount")),
        allowedActions: BigInt(req<bigint>(9, "allowedActions")),
      },
      balance: BigInt(req<bigint>(11, "balance")),
      epochSpent: BigInt(req<bigint>(10, "epochSpent")),
      feeBps:
        feeBpsResult.status === "success" ? Number(feeBpsResult.result as number | bigint) : 0,
      feeRecipient:
        feeRecipientResult.status === "success"
          ? (feeRecipientResult.result as Address)
          : ("0x0000000000000000000000000000000000000000" as Address),
    };
  }

  /** Check whether a recipient is allowlisted (useful for agent preflight). */
  async isAllowlisted(recipient: Address): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.vaultAddress,
      abi: vaultAbi as never,
      functionName: "allowlist",
      args: [recipient],
    }) as Promise<boolean>;
  }

  /**
   * Fetch executed + blocked payment events for the activity feed.
   * Defaults to a recent block window so public Arc RPC does not rate-limit.
   */
  async getActivity(
    fromBlockOrOpts?: bigint | { fromBlock?: bigint; lookbackBlocks?: bigint },
  ): Promise<ActivityEvent[]> {
    let fromBlock: bigint;
    if (typeof fromBlockOrOpts === "bigint") {
      fromBlock = fromBlockOrOpts;
    } else if (fromBlockOrOpts?.fromBlock !== undefined) {
      fromBlock = fromBlockOrOpts.fromBlock;
    } else {
      const lookback = fromBlockOrOpts?.lookbackBlocks ?? DEFAULT_ACTIVITY_LOOKBACK_BLOCKS;
      const current = await this.publicClient.getBlockNumber();
      fromBlock = current > lookback ? current - lookback : 0n;
    }

    const logs = await this.publicClient.getLogs({
      address: this.vaultAddress,
      fromBlock,
      toBlock: "latest",
    });

    const events: ActivityEvent[] = [];
    for (const log of logs) {
      let decoded: { eventName: string; args: unknown };
      try {
        decoded = decodeEventLog({
          abi: vaultAbi as never,
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
          txHash: log.transactionHash!,
          blockNumber: log.blockNumber!,
        });
      } else if (decoded.eventName === "PaymentBlocked") {
        const args = decoded.args as {
          to: Address;
          amount: bigint;
          actionType: number;
          reason: number;
        };
        const reason = args.reason as BlockReason;
        events.push({
          kind: "blocked",
          to: args.to,
          amount: args.amount,
          actionType: args.actionType as ActionType,
          reason,
          reasonCode: BlockReasonCode[reason] ?? `UNKNOWN_${args.reason}`,
          txHash: log.transactionHash!,
          blockNumber: log.blockNumber!,
        });
      }
    }
    return events;
  }

  // -------------------------------------------------------------------------
  // Petty-cash tier (x402 Nanopayments via Circle Gateway)
  // -------------------------------------------------------------------------

  private getGateway(): GatewayClient {
    if (!this.pettyCashKey) {
      throw new Error(
        "Petty-cash tier is disabled for this client (pettyCash: false). " +
          "Vault-tier pay() is unaffected.",
      );
    }
    if (!this.gateway) {
      this.gateway = createPettyCashGateway({
        privateKey: this.pettyCashKey,
        rpcUrl: this.rpcUrl,
      });
    }
    return this.gateway;
  }

  /**
   * Buy an x402-protected resource with a gasless Nanopayment. Exposure is
   * bounded on-chain by the Gateway deposit — NOT by vault rules; keep the
   * deposit petty-cash sized.
   */
  async buy(url: string): Promise<PettyCashResult> {
    const gateway = this.getGateway();
    try {
      const { data, status } = await gateway.pay(url);
      let remainingBalance: bigint | undefined;
      try {
        const balances = await gateway.getBalances();
        remainingBalance = balances.gateway.available;
      } catch {
        // Balance readback is best-effort; the purchase result stands alone.
      }
      return { status, data, remainingBalance };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const upper = message.toUpperCase();
      if (
        upper.includes("INSUFFICIENT") ||
        upper.includes("BALANCE") ||
        upper.includes("DEPOSIT")
      ) {
        const e = new Error(`INSUFFICIENT_GATEWAY_BALANCE: ${message}`);
        e.name = "INSUFFICIENT_GATEWAY_BALANCE";
        throw e;
      }
      throw err;
    }
  }

  /** One-time (or top-up) on-chain deposit into the petty-cash pocket. */
  async depositPettyCash(amount: string): Promise<{ depositTxHash?: string }> {
    const gateway = this.getGateway();
    const result = await gateway.deposit(amount);
    return { depositTxHash: (result as { depositTxHash?: string }).depositTxHash };
  }

  /** Remaining petty-cash (Gateway available) balance in 6-dec base units. */
  async getPettyCashBalance(address?: Address): Promise<bigint> {
    const gateway = this.getGateway();
    const balances = await gateway.getBalances(address);
    return balances.gateway.available;
  }
}
