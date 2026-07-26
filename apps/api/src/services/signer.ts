import crypto from 'node:crypto';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, http, createPublicClient, parseAbi, keccak256, toBytes } from 'viem';
import { arcTestnet } from '@peribolos/core';
import { db, ManagedSignerRecord } from '../db/store.js';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const DEFAULT_KEY_SECRET = process.env.SIGNER_ENCRYPTION_KEY || 'peribolos-v2-dev-signer-master-secret-key-32b!';

// Ensure key is exactly 32 bytes
function getSecretKey(): Buffer {
  return crypto.createHash('sha256').update(DEFAULT_KEY_SECRET).digest();
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

export type VaultPayResult = {
  txHash?: `0x${string}`;
  status: 'EXECUTED' | 'BLOCKED' | 'FAILED';
  reasonCode?: string;
  reasonDescription?: string;
};

export class ManagedSignerService {
  private publicClient;

  constructor() {
    this.publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network')
    });
  }

  public provisionSigner(vaultId: string, agentId: string): { address: `0x${string}`; record: ManagedSignerRecord } {
    const rawPrivateKey = generatePrivateKey();
    const account = privateKeyToAccount(rawPrivateKey);
    const encrypted = encryptPrivateKey(rawPrivateKey);

    const record: ManagedSignerRecord = {
      id: `ms_${crypto.randomBytes(8).toString('hex')}`,
      vaultId,
      agentId,
      address: account.address,
      encryptedPrivateKey: encrypted.encryptedPrivateKey,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    db.addManagedSigner(record);
    // Never return the private key — only the address and non-secret record metadata
    return { address: account.address, record };
  }

  public getSignerAccount(signerRecord: ManagedSignerRecord) {
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

    if (!/^0x[0-9a-fA-F]{40}$/.test(params.vaultAddress)) {
      return {
        status: 'FAILED',
        reasonCode: 'INVALID_VAULT_ADDRESS',
        reasonDescription: 'Vault address is not a valid 20-byte hex address.'
      };
    }

    try {
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

      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== params.vaultAddress.toLowerCase()) continue;
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

  public rotateSigner(vaultId: string, agentId: string): { newAddress: `0x${string}`; newRecord: ManagedSignerRecord } {
    const existing = db.getManagedSignerByAgent(agentId);
    if (existing) {
      existing.status = 'rotated';
      existing.rotatedAt = new Date().toISOString();
      db.save();
    }

    const { address, record } = this.provisionSigner(vaultId, agentId);
    return { newAddress: address, newRecord: record };
  }

  public revokeSigner(agentId: string): boolean {
    return db.revokeManagedSigner(agentId);
  }
}

export const signerService = new ManagedSignerService();
