/**
 * PeribolosHostedClient — Hosted API Client for No-Terminal Agent Payments
 */

export interface PeribolosHostedClientConfig {
  apiKey: string; // Bearer pb_live_...
  baseUrl?: string; // Default http://localhost:3400
}

export interface HostedPaymentParams {
  payeeAddress: `0x${string}`;
  amountUsdc: number;
  actionType?: number;
  idempotencyKey?: string;
  metadataHash?: `0x${string}`;
}

export interface HostedPaymentResult {
  id: string;
  idempotencyKey: string;
  status: 'EXECUTED' | 'BLOCKED' | 'FAILED';
  amountUsdc?: number;
  payeeAddress?: `0x${string}`;
  payeeName?: string;
  blockReasonCode?: string;
  blockReasonDescription?: string;
  txHash?: `0x${string}`;
  explorerUrl?: string;
}

export class PeribolosHostedClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: PeribolosHostedClientConfig) {
    if (!config.apiKey) {
      throw new Error('PeribolosHostedClient requires an apiKey (pb_live_...)');
    }
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'http://localhost:3400';
  }

  public async pay(params: HostedPaymentParams): Promise<HostedPaymentResult> {
    const url = `${this.baseUrl}/v1/payments`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(params)
    });

    const body = (await res.json()) as HostedPaymentResult;
    if (!res.ok && res.status !== 403) {
      throw new Error((body as any).message || `Payment API error ${res.status}`);
    }
    return body;
  }

  public async getPaymentStatus(paymentId: string): Promise<HostedPaymentResult> {
    const url = `${this.baseUrl}/v1/payments/${paymentId}`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch payment status: ${res.statusText}`);
    }
    return (await res.json()) as HostedPaymentResult;
  }
}
