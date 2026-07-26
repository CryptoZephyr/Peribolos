import { createPublicClient, http } from 'viem';
import { arcTestnet } from '@peribolos/core';
import { db, ChainEventRecord } from '../db/store.js';

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
    // Initial run
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
    const vaults = db.getVaults();
    if (vaults.length === 0) return;

    for (const vault of vaults) {
      try {
        const currentBlock = await this.publicClient.getBlockNumber();
        const fromBlock = currentBlock > 100n ? currentBlock - 100n : 0n;

        // Fetch logs for this vault address
        const logs = await this.publicClient.getLogs({
          address: vault.address,
          fromBlock,
          toBlock: currentBlock
        });

        for (const log of logs) {
          // Normalize event
          const txHash = log.transactionHash;
          const blockNumber = Number(log.blockNumber);

          // Record placeholder event if log found
          db.addChainEvent({
            id: `evt_${log.transactionHash.slice(0, 10)}_${log.logIndex}`,
            vaultAddress: vault.address,
            eventType: 'PaymentExecuted',
            txHash,
            blockNumber,
            timestamp: new Date().toISOString()
          });
        }
      } catch (err) {
        // Silently swallow network RPC polling glitches
      }
    }
  }
}

export const eventIndexer = new EventIndexerService();
