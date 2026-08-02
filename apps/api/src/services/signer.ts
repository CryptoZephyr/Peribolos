import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, http, createPublicClient, parseAbi, keccak256, toBytes, formatUnits } from 'viem';
import { arcTestnet } from '@peribolos/core';
import { db, ManagedSignerRecord } from '../db/store.js';
import {
  initiateDeveloperControlledWalletsClient,
  type CircleDeveloperControlledWalletsClient,
} from '@circle-fin/developer-controlled-wallets';

// Load the API-local env before constructing the signer singleton.
dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const DEV_KEY_SECRET = 'peribolos-v2-dev-signer-master-secret-key-32b!';

// Ensure key is exactly 32 bytes
function getSecretKey(): Buffer {
  const configured = process.env.SIGNER_ENCRYPTION_KEY?.trim();
  if (!configured && process.env.NODE_ENV === 'production') {
    throw new Error('SIGNER_ENCRYPTION_KEY is required in production.');
  }
  return crypto.createHash('sha256').update(configured || DEV_KEY_SECRET).digest();
}

export function encryptPrivateKey(privateKeyHex: string): { encryptedPrivateKey: string; iv: string; authTag: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, getSecretKey(), iv);
  let encrypted = cipher.update(privateKeyHex, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return {
    encryptedPrivateKey: encrypted,
    iv: iv.toString('hex'),
    authTag
  };
}

export function decryptPrivateKey(encryptedHex: string, ivHex: string, authTagHex: string): `0x${string}` {
  const decipher = crypto.createDecipheriv(
    ENCRYPTION_ALGORITHM,
    getSecretKey(),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted as `0x${string}`;
}

// Must match contracts/src/PeribolosVault.sol exactly (pay has NO metadataHash).
export const PERIBOLOS_VAULT_ABI = parseAbi([
  'function pay(address to, uint256 amount, uint8 actionType) external returns (bool executed)',
  'function agentKey() external view returns (address)',
  'function owner() external view returns (address)',
  'function dailyCap() external view returns (uint128)',
  'function perTxCap() external view returns (uint128)',
  'function epochSpent() external view returns (uint128)',
  'function allowedActions() external view returns (uint256)',
  'function agentExpiry() external view returns (uint64)',
  'function usdc() external view returns (address)',
  'function paused() external view returns (bool)',
  'function allowlist(address target) external view returns (bool)',
  'event PaymentExecuted(address indexed to, uint256 amount, uint8 indexed actionType, uint256 epochSpent)',
  'event PaymentBlocked(address indexed to, uint256 amount, uint8 indexed actionType, uint8 indexed reason)'
]);

const PAYMENT_EXECUTED_TOPIC = keccak256(
  toBytes('PaymentExecuted(address,uint256,uint8,uint256)')
);
const PAYMENT_BLOCKED_TOPIC = keccak256(
  toBytes('PaymentBlocked(address,uint256,uint8,uint8)')
);

const ERC20_BALANCE_ABI = parseAbi([
  'function balanceOf(address account) external view returns (uint256)'
]);

export type VaultPayResult = {
  txHash?: `0x${string}`;
  status: 'EXECUTED' | 'BLOCKED' | 'FAILED';
  reasonCode?: string;
  reasonDescription?: string;
};

export type SignerReadiness = {
  network: {
    name: 'Arc Testnet';
    chainId: 5042002;
    rpcUrlConfigured: boolean;
  };
  provider: 'circle-dcw' | 'local-dev' | 'unconfigured';
  circle: {
    configured: boolean;
    disabled: boolean;
    apiKeyConfigured: boolean;
    entitySecretConfigured: boolean;
    entitySecretEnvName?: 'ENTITY_SECRET' | 'CIRCLE_ENTITY_SECRET';
    walletSetConfigured: boolean;
    missingEnv: string[];
  };
  localFallbackEnabled: boolean;
};

function readTrimmedEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export class ManagedSignerService {
  private publicClient;
  private circleClient?: CircleDeveloperControlledWalletsClient;
  private circleWalletSetId?: string;
  private circleApiKeyConfigured = false;
  private circleEntitySecretConfigured = false;
  private circleEntitySecretEnvName?: 'ENTITY_SECRET' | 'CIRCLE_ENTITY_SECRET';
  private circleDisabled = false;

  constructor() {
    this.publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network')
    });

    const apiKey = readTrimmedEnv('CIRCLE_API_KEY');
    const entitySecret = readTrimmedEnv('ENTITY_SECRET') || readTrimmedEnv('CIRCLE_ENTITY_SECRET');
    this.circleApiKeyConfigured = Boolean(apiKey);
    this.circleEntitySecretConfigured = Boolean(entitySecret);
    this.circleEntitySecretEnvName = readTrimmedEnv('ENTITY_SECRET')
      ? 'ENTITY_SECRET'
      : readTrimmedEnv('CIRCLE_ENTITY_SECRET')
        ? 'CIRCLE_ENTITY_SECRET'
        : undefined;
    this.circleWalletSetId = readTrimmedEnv('CIRCLE_WALLET_SET_ID');
    this.circleDisabled = process.env.NODE_ENV === 'test' || readTrimmedEnv('PERIBOLOS_DISABLE_CIRCLE_DCW') === '1';
    if (!this.circleDisabled && apiKey && entitySecret) {
      this.circleClient = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
      if (!this.circleWalletSetId) {
        console.warn('[Signer] Circle credentials found but CIRCLE_WALLET_SET_ID is missing; DCW provisioning is disabled.');
      }
    }
    if (process.env.NODE_ENV === 'production' && (!this.circleClient || !this.circleWalletSetId)) {
      console.error(
        '[Signer] Circle DCW is not configured; signer provisioning and live payments are disabled until CIRCLE_API_KEY, ENTITY_SECRET, and CIRCLE_WALLET_SET_ID are set.'
      );
    }
  }

  public getReadiness(): SignerReadiness {
    const missingEnv: string[] = [];
    if (!this.circleApiKeyConfigured) missingEnv.push('CIRCLE_API_KEY');
    if (!this.circleEntitySecretConfigured) missingEnv.push('ENTITY_SECRET');
    if (!this.circleWalletSetId) missingEnv.push('CIRCLE_WALLET_SET_ID');
    const configured = missingEnv.length === 0;
    const activeCircle = configured && !this.circleDisabled;
    const localFallbackEnabled = process.env.NODE_ENV === 'test'
      || readTrimmedEnv('PERIBOLOS_ENABLE_LOCAL_SIGNER') === '1';

    return {
      network: {
        name: 'Arc Testnet',
        chainId: 5042002,
        rpcUrlConfigured: Boolean(readTrimmedEnv('ARC_RPC_URL')),
      },
      provider: activeCircle ? 'circle-dcw' : localFallbackEnabled ? 'local-dev' : 'unconfigured',
      circle: {
        configured,
        disabled: this.circleDisabled,
        apiKeyConfigured: this.circleApiKeyConfigured,
        entitySecretConfigured: this.circleEntitySecretConfigured,
        entitySecretEnvName: this.circleEntitySecretEnvName,
        walletSetConfigured: Boolean(this.circleWalletSetId),
        missingEnv,
      },
      localFallbackEnabled: !activeCircle && localFallbackEnabled,
    };
  }

  /** Verify that a candidate address is a real Arc vault and uses the managed signer. */
  public async verifyVaultAddress(
    vaultAddress: `0x${string}`,
    expectedAgentKey?: `0x${string}`
  ): Promise<{ valid: boolean; reasonCode?: string; reasonDescription?: string; agentKey?: `0x${string}` }> {
    try {
      const bytecode = await this.publicClient.getBytecode({ address: vaultAddress });
      if (!bytecode || bytecode === '0x') {
        return { valid: false, reasonCode: 'NO_CONTRACT_CODE', reasonDescription: 'The address has no contract bytecode on Arc Testnet.' };
      }
      const agentKey = await this.publicClient.readContract({
        address: vaultAddress,
        abi: PERIBOLOS_VAULT_ABI,
        functionName: 'agentKey'
      });
      if (expectedAgentKey && agentKey.toLowerCase() !== expectedAgentKey.toLowerCase()) {
        return {
          valid: false,
          agentKey,
          reasonCode: 'SIGNER_MISMATCH',
          reasonDescription: `Vault agentKey ${agentKey} does not match managed signer ${expectedAgentKey}.`
        };
      }
      return { valid: true, agentKey };
    } catch (err: unknown) {
      return {
        valid: false,
        reasonCode: 'VAULT_READ_FAILED',
        reasonDescription: err instanceof Error ? err.message.slice(0, 300) : 'Unable to read the vault on Arc Testnet.'
      };
    }
  }

  public async readVaultAuthorization(vaultAddress: `0x${string}`): Promise<{
    agentKey: `0x${string}`;
    agentExpiry: bigint;
  }> {
    const [agentKey, agentExpiry] = await Promise.all([
      this.publicClient.readContract({
        address: vaultAddress,
        abi: PERIBOLOS_VAULT_ABI,
        functionName: 'agentKey'
      }),
      this.publicClient.readContract({
        address: vaultAddress,
        abi: PERIBOLOS_VAULT_ABI,
        functionName: 'agentExpiry'
      })
    ]);
    return { agentKey, agentExpiry };
  }

  public async readVaultState(vaultAddress: `0x${string}`): Promise<{
    owner: `0x${string}`;
    agentKey: `0x${string}`;
    agentExpiry: bigint;
    usdcToken: `0x${string}`;
    balanceUsdcUnits: bigint;
    balanceUsdc: string;
    paused: boolean;
    perTxCapUsdcUnits: bigint;
    dailyCapUsdcUnits: bigint;
    epochSpentUsdcUnits: bigint;
  }> {
    const [owner, agentKey, agentExpiry, usdcToken, paused, perTxCap, dailyCap, epochSpent] = await Promise.all([
      this.publicClient.readContract({ address: vaultAddress, abi: PERIBOLOS_VAULT_ABI, functionName: 'owner' }),
      this.publicClient.readContract({ address: vaultAddress, abi: PERIBOLOS_VAULT_ABI, functionName: 'agentKey' }),
      this.publicClient.readContract({ address: vaultAddress, abi: PERIBOLOS_VAULT_ABI, functionName: 'agentExpiry' }),
      this.publicClient.readContract({ address: vaultAddress, abi: PERIBOLOS_VAULT_ABI, functionName: 'usdc' }),
      this.publicClient.readContract({ address: vaultAddress, abi: PERIBOLOS_VAULT_ABI, functionName: 'paused' }),
      this.publicClient.readContract({ address: vaultAddress, abi: PERIBOLOS_VAULT_ABI, functionName: 'perTxCap' }),
      this.publicClient.readContract({ address: vaultAddress, abi: PERIBOLOS_VAULT_ABI, functionName: 'dailyCap' }),
      this.publicClient.readContract({ address: vaultAddress, abi: PERIBOLOS_VAULT_ABI, functionName: 'epochSpent' })
    ]);
    const balanceUsdcUnits = await this.publicClient.readContract({
      address: usdcToken,
      abi: ERC20_BALANCE_ABI,
      functionName: 'balanceOf',
      args: [vaultAddress]
    });
    return {
      owner,
      agentKey,
      agentExpiry,
      usdcToken,
      balanceUsdcUnits,
      balanceUsdc: formatUnits(balanceUsdcUnits, 6),
      paused,
      perTxCapUsdcUnits: perTxCap,
      dailyCapUsdcUnits: dailyCap,
      epochSpentUsdcUnits: epochSpent
    };
  }

  public async provisionSigner(
    vaultId: string,
    agentId: string,
    status: ManagedSignerRecord['status'] = 'active'
  ): Promise<{ address: `0x${string}`; record: ManagedSignerRecord }> {
    if (this.circleClient && this.circleWalletSetId) {
      const response = await this.circleClient.createWallets({
        walletSetId: this.circleWalletSetId,
        blockchains: ['ARC-TESTNET'],
        accountType: 'EOA',
        count: 1,
        idempotencyKey: crypto.randomUUID(),
      });
      const wallet = response.data?.wallets?.[0];
      if (!wallet?.id || !wallet.address) {
        throw new Error('Circle did not return a usable Arc Testnet wallet.');
      }
      const record: ManagedSignerRecord = {
        id: `ms_${crypto.randomBytes(8).toString('hex')}`,
        vaultId,
        agentId,
        address: wallet.address as `0x${string}`,
        walletId: wallet.id,
        provider: 'circle',
        encryptedPrivateKey: '',
        iv: '',
        authTag: '',
        status,
        createdAt: new Date().toISOString(),
      };
      db.addManagedSigner(record);
      return { address: record.address, record };
    }

    const localFallbackEnabled = process.env.NODE_ENV === 'test'
      || readTrimmedEnv('PERIBOLOS_ENABLE_LOCAL_SIGNER') === '1';
    if (!localFallbackEnabled) {
      throw new Error(
        'Circle DCW is not configured. Set CIRCLE_API_KEY, ENTITY_SECRET, and CIRCLE_WALLET_SET_ID; local signers are disabled unless PERIBOLOS_ENABLE_LOCAL_SIGNER=1 is explicitly set.'
      );
    }

    const rawPrivateKey = generatePrivateKey();
    const account = privateKeyToAccount(rawPrivateKey);
    const encrypted = encryptPrivateKey(rawPrivateKey);

    const record: ManagedSignerRecord = {
      id: `ms_${crypto.randomBytes(8).toString('hex')}`,
      vaultId,
      agentId,
      address: account.address,
      provider: 'local',
      encryptedPrivateKey: encrypted.encryptedPrivateKey,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      status,
      createdAt: new Date().toISOString()
    };

    db.addManagedSigner(record);
    // Never return the private key — only the address and non-secret record metadata
    return { address: account.address, record };
  }

  public getSignerAccount(signerRecord: ManagedSignerRecord) {
    if (!signerRecord.encryptedPrivateKey || !signerRecord.iv || !signerRecord.authTag) {
      throw new Error('Local signer record is missing encrypted key material.');
    }
    const privateKey = decryptPrivateKey(
      signerRecord.encryptedPrivateKey,
      signerRecord.iv,
      signerRecord.authTag
    );
    return privateKeyToAccount(privateKey);
  }

  /**
   * Submit vault.pay on Arc. Never fabricates success.
   * On any chain/signer failure returns status FAILED with a reason — never a random EXECUTED hash.
   */
  public async executeVaultPay(params: {
    vaultAddress: `0x${string}`;
    signerRecord: ManagedSignerRecord;
    recipient: `0x${string}`;
    amountUsdcUnits: bigint; // 6 decimals
    actionType: number;
    metadataHash?: `0x${string}`; // ignored — not in on-chain pay()
  }): Promise<VaultPayResult> {
    if (params.signerRecord.status !== 'active') {
      return {
        status: 'FAILED',
        reasonCode: 'SIGNER_NOT_ACTIVE',
        reasonDescription: `Managed signer status is ${params.signerRecord.status}; cannot sign vault.pay.`
      };
    }

    const circleConfigured = Boolean(this.circleClient && this.circleWalletSetId) && !this.circleDisabled;
    if (circleConfigured && params.signerRecord.provider !== 'circle') {
      return {
        status: 'FAILED',
        reasonCode: 'LEGACY_LOCAL_SIGNER_DISABLED',
        reasonDescription: 'This workspace is configured for Circle DCW; legacy local signers cannot authorize payments.'
      };
    }

    if (!/^0x[0-9a-fA-F]{40}$/.test(params.vaultAddress)) {
      return {
        status: 'FAILED',
        reasonCode: 'INVALID_VAULT_ADDRESS',
        reasonDescription: 'Vault address is not a valid 20-byte hex address.'
      };
    }

    try {
      // The chain is authoritative for authorization.  Check the vault's
      // current agentKey before asking Circle (or the local fallback) to sign;
      // this prevents a stale database mapping from spending gas on a call
      // that the vault will reject with NotAgent.
      const onChainAgentKey = await this.publicClient.readContract({
        address: params.vaultAddress,
        abi: PERIBOLOS_VAULT_ABI,
        functionName: 'agentKey'
      });
      if (onChainAgentKey.toLowerCase() !== params.signerRecord.address.toLowerCase()) {
        return {
          status: 'FAILED',
          reasonCode: 'SIGNER_MISMATCH',
          reasonDescription:
            `Vault agentKey ${onChainAgentKey} does not match managed signer ${params.signerRecord.address}. ` +
            'Rotate the vault agent key from its owner wallet, then retry.'
        };
      }

      if (params.signerRecord.provider === 'circle' || params.signerRecord.walletId) {
        if (!this.circleClient || !params.signerRecord.walletId) {
          return {
            status: 'FAILED',
            reasonCode: 'CIRCLE_NOT_CONFIGURED',
            reasonDescription: 'Circle DCW credentials or wallet metadata are unavailable.'
          };
        }

        const submitted = await this.circleClient.createContractExecutionTransaction({
          walletId: params.signerRecord.walletId,
          contractAddress: params.vaultAddress,
          abiFunctionSignature: 'pay(address,uint256,uint8)',
          abiParameters: [params.recipient, params.amountUsdcUnits.toString(), params.actionType.toString()],
          fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
          idempotencyKey: crypto.randomUUID(),
          refId: `peribolos:${params.signerRecord.agentId}`,
        });
        const transactionId = submitted.data?.id;
        if (!transactionId) {
          return {
            status: 'FAILED',
            reasonCode: 'CIRCLE_NO_TRANSACTION_ID',
            reasonDescription: 'Circle accepted the request without returning a transaction id.'
          };
        }
        const completed = await this.circleClient.getTransaction({
          id: transactionId,
          waitForState: 'COMPLETE',
          pollingInterval: 1000,
        });
        const tx = completed.data?.transaction;
        if (!tx?.txHash) {
          return {
            status: 'FAILED',
            reasonCode: 'CIRCLE_NO_TX_HASH',
            reasonDescription: `Circle transaction ${transactionId} completed without a transaction hash.`
          };
        }
        return this.classifyVaultReceipt(tx.txHash as `0x${string}`, params.vaultAddress);
      }

      const account = this.getSignerAccount(params.signerRecord);
      const rpcUrl = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network';
      const walletClient = createWalletClient({
        account,
        chain: arcTestnet,
        transport: http(rpcUrl)
      });

      // On-chain: pay(to, amount, actionType) — three args only
      const hash = await walletClient.writeContract({
        address: params.vaultAddress,
        abi: PERIBOLOS_VAULT_ABI,
        functionName: 'pay',
        args: [params.recipient, params.amountUsdcUnits, params.actionType]
      });

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

      return this.classifyVaultReceipt(hash, params.vaultAddress, receipt.logs);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.log('[Signer] On-chain execution failed (honest FAILED):', message.slice(0, 200));
      return {
        status: 'FAILED',
        reasonCode: 'CHAIN_EXECUTION_FAILED',
        reasonDescription: message.slice(0, 300)
      };
    }
  }

  private async classifyVaultReceipt(
    hash: `0x${string}`,
    vaultAddress: `0x${string}`,
    knownLogs?: readonly { address: string; topics: readonly `0x${string}`[] }[]
  ): Promise<VaultPayResult> {
    const logs = knownLogs ?? (await this.publicClient.getTransactionReceipt({ hash })).logs;
    for (const log of logs) {
        if (log.address.toLowerCase() !== vaultAddress.toLowerCase()) continue;
        const topic0 = log.topics[0];
        if (topic0 === PAYMENT_BLOCKED_TOPIC) {
          // PaymentBlocked(to, amount, actionType, reason) — reason is indexed topic
          const reasonTopic = log.topics[3];
          const reasonOrdinal = reasonTopic ? Number(BigInt(reasonTopic)) : 0;
          const reasonMap: Record<number, string> = {
            1: 'RECIPIENT_NOT_ALLOWLISTED',
            2: 'EXCEEDS_PER_TX_CAP',
            3: 'EXCEEDS_DAILY_CAP',
            4: 'ACTION_NOT_ALLOWED',
            5: 'AGENT_KEY_EXPIRED',
            6: 'VAULT_PAUSED',
            7: 'INSUFFICIENT_BALANCE',
            8: 'TRANSFER_FAILED'
          };
          return {
            txHash: hash,
            status: 'BLOCKED',
            reasonCode: reasonMap[reasonOrdinal] || 'PAYMENT_BLOCKED',
            reasonDescription: `On-chain PaymentBlocked (reason ordinal ${reasonOrdinal}).`
          };
        }
        if (topic0 === PAYMENT_EXECUTED_TOPIC) {
          return { txHash: hash, status: 'EXECUTED' };
        }
    }

      // Receipt succeeded but no vault events — do not invent EXECUTED
      return {
        txHash: hash,
        status: 'FAILED',
        reasonCode: 'NO_VAULT_EVENT',
        reasonDescription: 'Transaction mined but no PaymentExecuted/PaymentBlocked event from vault.'
      };
    }

  public async rotateSigner(vaultId: string, agentId: string): Promise<{ newAddress: `0x${string}`; newRecord: ManagedSignerRecord }> {
    const existing = db.getManagedSignerByAgent(agentId);
    if (existing) {
      existing.status = 'rotated';
      existing.rotatedAt = new Date().toISOString();
      db.save();
    }

    const { address, record } = await this.provisionSigner(vaultId, agentId);
    return { newAddress: address, newRecord: record };
  }

  public revokeSigner(agentId: string): boolean {
    return db.revokeManagedSigner(agentId);
  }
}

export const signerService = new ManagedSignerService();
