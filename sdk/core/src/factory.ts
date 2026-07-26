/**
 * PeribolosFactoryClient — owner-side client for creating domains.
 *
 * Used by scripts and the (Phase 3) dashboard. Holds an OWNER key, which is a
 * different trust level from the agent key in PeribolosVaultClient — never mix
 * the two in one process in production code.
 */

import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  type Account,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import factoryAbiJson from "./abi/PeribolosFactory.json" with { type: "json" };
import { PERIBOLOS_FACTORY_ADDRESS, arcTestnet } from "./constants.js";
import { createArcTransport, resolveArcRpcUrl } from "./rpc.js";
import type { CreateDomainParams } from "./types.js";

const factoryAbi = (factoryAbiJson as { abi?: unknown }).abi ?? factoryAbiJson;

export interface PeribolosFactoryClientConfig {
  /** Domain OWNER private key (not the agent key). */
  ownerPrivateKey: Hex;
  /** Override the factory address (defaults to the canonical deployment). */
  factoryAddress?: Address;
  rpcUrl?: string;
}

export class PeribolosFactoryClient {
  readonly factoryAddress: Address;
  readonly ownerAddress: Address;

  private readonly account: Account;
  private readonly publicClient: PublicClient;
  private readonly walletClient: WalletClient;

  constructor(config: PeribolosFactoryClientConfig) {
    this.factoryAddress = config.factoryAddress ?? PERIBOLOS_FACTORY_ADDRESS;
    this.account = privateKeyToAccount(config.ownerPrivateKey);
    this.ownerAddress = this.account.address;

    const transport = createArcTransport({ rpcUrl: resolveArcRpcUrl(config.rpcUrl) });
    this.publicClient = createPublicClient({ chain: arcTestnet, transport });
    this.walletClient = createWalletClient({
      chain: arcTestnet,
      transport,
      account: this.account,
    });
  }

  /**
   * Deploy and fund a new domain in one transaction. `valueWei` is the total
   * native USDC (18-dec) sent: `agentGasWei` goes to the agent EOA for gas,
   * the remainder becomes the vault's treasury balance.
   */
  async createDomain(params: CreateDomainParams): Promise<{ vault: Address; txHash: Hex }> {
    const txHash = await this.walletClient.writeContract({
      chain: arcTestnet,
      account: this.account,
      address: this.factoryAddress,
      abi: factoryAbi as never,
      functionName: "createDomain",
      args: [
        {
          treasury: params.treasury,
          agentKey: params.agentKey,
          agentExpiry: params.agentExpiry,
          perTxCap: params.perTxCap,
          dailyCap: params.dailyCap,
          floatAmount: params.floatAmount,
          allowedActions: params.allowedActions,
          allowlist: params.allowlist,
        },
        params.agentMetadataURI,
        params.agentGasWei,
      ],
      value: params.valueWei,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== this.factoryAddress.toLowerCase()) continue;
      try {
        const decoded = decodeEventLog({
          abi: factoryAbi as never,
          data: log.data,
          topics: log.topics,
        }) as unknown as { eventName: string; args: { vault: Address } };
        if (decoded.eventName === "DomainCreated") {
          return { vault: decoded.args.vault, txHash };
        }
      } catch {
        continue;
      }
    }
    throw new Error(`createDomain(): no DomainCreated event in tx ${txHash}`);
  }

  /** All vaults ever created by an owner address. */
  async domainsOf(owner: Address): Promise<Address[]> {
    return this.publicClient.readContract({
      address: this.factoryAddress,
      abi: factoryAbi as never,
      functionName: "domainsOf",
      args: [owner],
    }) as Promise<Address[]>;
  }
}
