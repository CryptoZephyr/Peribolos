import { createPublicClient, decodeEventLog, http, parseAbi } from 'viem';
import { arcTestnet } from '@peribolos/core';
import { db } from '../db/store.js';

const REASON_CODES: Record<number, string> = {
  0: 'NONE',
  1: 'RECIPIENT_NOT_ALLOWLISTED',
  2: 'EXCEEDS_PER_TX_CAP',
  3: 'EXCEEDS_DAILY_CAP',
  4: 'ACTION_NOT_ALLOWED',
  5: 'AGENT_KEY_EXPIRED',
  6: 'VAULT_PAUSED',
  7: 'INSUFFICIENT_BALANCE',
  8: 'TRANSFER_FAILED'
};

const VAULT_EVENT_ABI = parseAbi([
  'event PaymentExecuted(address indexed to, uint256 amount, uint8 indexed actionType, uint256 epochSpent)',
  'event PaymentBlocked(address indexed to, uint256 amount, uint8 indexed actionType, uint8 indexed reason)',
  'event RulesUpdated(uint128 perTxCap, uint128 dailyCap, uint128 floatAmount, uint256 allowedActions)',
  'event AgentKeyRotated(address indexed newAgentKey, uint64 newExpiry)',
  'event Swept(address indexed treasury, uint256 amount)',
  'event Withdrawn(address indexed to, uint256 amount)'
]);

function usdcUnitsToNumber(amount: bigint): number {
  return Number(amount) / 1_000_000;
}

export class EventIndexerService {
  private publicClient;
  private isPolling = false;
  private timer: NodeJS.Timeout | null = null;

  constructor() {
    this.publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network')
    });
  }

  public start(intervalMs = 15000): void {
    if (this.isPolling) return;
    this.isPolling = true;
    console.log('[Indexer] Starting Arc log polling event indexer...');

    this.timer = setInterval(() => {
      this.poll().catch(err => console.error('[Indexer] Poll error:', err));
    }, intervalMs);
    this.poll().catch(err => console.error('[Indexer] Poll error:', err));
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isPolling = false;
  }

  private async poll(): Promise<void> {
    const vaults = db.getVaults().filter(v => v.mode === 'live' && /^0x[0-9a-fA-F]{40}$/.test(v.address));
    if (vaults.length === 0) return;

    const currentBlock = await this.publicClient.getBlockNumber();
    const fromBlock = currentBlock > 5_000n ? currentBlock - 5_000n : 0n;

    for (const vault of vaults) {
      try {
        const logs = await this.publicClient.getLogs({
          address: vault.address,
          fromBlock,
          toBlock: currentBlock
        });

        for (const log of logs) {
          const txHash = log.transactionHash;
          const blockNumber = Number(log.blockNumber);
          const id = `evt_${txHash}_${log.logIndex}`;
          let decoded: { eventName: string; args: any };
          try {
            decoded = decodeEventLog({
              abi: VAULT_EVENT_ABI,
              data: log.data,
              topics: log.topics
            }) as { eventName: string; args: any };
          } catch {
            continue;
          }

          if (decoded.eventName === 'PaymentExecuted') {
            db.addChainEvent({
              id,
              vaultAddress: vault.address,
              eventType: 'PaymentExecuted',
              recipient: decoded.args.to,
              amountUsdc: usdcUnitsToNumber(decoded.args.amount),
              actionType: Number(decoded.args.actionType),
              txHash,
              blockNumber,
              timestamp: new Date().toISOString()
            });
          } else if (decoded.eventName === 'PaymentBlocked') {
            const reasonOrdinal = Number(decoded.args.reason);
            db.addChainEvent({
              id,
              vaultAddress: vault.address,
              eventType: 'PaymentBlocked',
              recipient: decoded.args.to,
              amountUsdc: usdcUnitsToNumber(decoded.args.amount),
              actionType: Number(decoded.args.actionType),
              reasonOrdinal,
              reasonCode: REASON_CODES[reasonOrdinal] || 'PAYMENT_BLOCKED',
              txHash,
              blockNumber,
              timestamp: new Date().toISOString()
            });
          } else if (decoded.eventName === 'RulesUpdated') {
            db.addChainEvent({
              id,
              vaultAddress: vault.address,
              eventType: 'RulesUpdated',
              txHash,
              blockNumber,
              timestamp: new Date().toISOString()
            });
          } else if (decoded.eventName === 'AgentKeyRotated') {
            db.addChainEvent({
              id,
              vaultAddress: vault.address,
              eventType: 'AgentKeyRotated',
              agentKey: decoded.args.newAgentKey,
              txHash,
              blockNumber,
              timestamp: new Date().toISOString()
            });
          } else if (decoded.eventName === 'Swept') {
            db.addChainEvent({
              id,
              vaultAddress: vault.address,
              eventType: 'Swept',
              recipient: decoded.args.treasury,
              amountUsdc: usdcUnitsToNumber(decoded.args.amount),
              txHash,
              blockNumber,
              timestamp: new Date().toISOString()
            });
          } else if (decoded.eventName === 'Withdrawn') {
            db.addChainEvent({
              id,
              vaultAddress: vault.address,
              eventType: 'Withdrawn',
              recipient: decoded.args.to,
              amountUsdc: usdcUnitsToNumber(decoded.args.amount),
              txHash,
              blockNumber,
              timestamp: new Date().toISOString()
            });
          }
        }
      } catch (err) {
        console.warn('[Indexer] Vault poll skipped:', vault.address, err instanceof Error ? err.message : err);
      }
    }
  }
}

export const eventIndexer = new EventIndexerService();
