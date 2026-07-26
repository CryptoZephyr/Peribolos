import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface User {
  id: string;
  workspaceId: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
  createdAt: string;
}

export interface Agent {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  framework: string; // e.g. "langchain" | "openai-agents-sdk" | "crewai" | "custom"
  status: 'active' | 'paused' | 'revoked';
  createdAt: string;
}

/**
 * Vault product record.
 * - mode "offline": policy preflight is authoritative for allow/block demos;
 *   chain submission is not attempted and EXECUTED is never claimed.
 * - mode "live": vault.address is a real on-chain PeribolosVault; managed
 *   signer submits vault.pay and reports honest EXECUTED/BLOCKED/FAILED.
 */
export interface VaultRecord {
  id: string;
  workspaceId: string;
  agentId: string;
  address: `0x${string}`;
  ownerAddress: `0x${string}`;
  agentSignerAddress: `0x${string}`;
  treasuryAddress: `0x${string}`;
  dailyCapUsdc: number;
  perTxCapUsdc: number;
  allowedActionsBitmap: number;
  agentKeyExpiresAt: number; // Unix timestamp in seconds
  paused: boolean;
  /** offline = no chain claim; live = real vault address on Arc */
  mode: 'offline' | 'live';
  createdAt: string;
}

export interface ManagedSignerRecord {
  id: string;
  vaultId: string;
  agentId: string;
  address: `0x${string}`;
  encryptedPrivateKey: string; // AES-256-GCM
  iv: string;
  authTag: string;
  status: 'active' | 'rotated' | 'revoked';
  createdAt: string;
  rotatedAt?: string;
}

export interface PayeeRecord {
  id: string;
  workspaceId: string;
  name: string;
  address: `0x${string}`;
  category: 'api' | 'data' | 'compute' | 'service' | 'other';
  description: string;
  allowedActionType: number;
  defaultLimitUsdc: number;
  verified: boolean;
  createdAt: string;
}

export interface ApiKeyRecord {
  id: string;
  workspaceId: string;
  agentId: string;
  keyPrefix: string; // e.g. pb_live_a1b2
  keyHash: string; // SHA-256 of raw key
  name: string;
  status: 'active' | 'revoked';
  lastUsedAt?: string;
  createdAt: string;
}

export interface PaymentRequestRecord {
  id: string;
  workspaceId: string;
  agentId: string;
  vaultId: string;
  idempotencyKey: string;
  payeeAddress: `0x${string}`;
  payeeName?: string;
  amountUsdc: number;
  actionType: number;
  metadataHash: `0x${string}`;
  status: 'EXECUTED' | 'BLOCKED' | 'PENDING' | 'FAILED';
  blockReasonCode?: string;
  blockReasonDescription?: string;
  txHash?: `0x${string}`;
  blockNumber?: number;
  gasUsedUsdc?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChainEventRecord {
  id: string;
  vaultAddress: `0x${string}`;
  eventType: 'PaymentExecuted' | 'PaymentBlocked' | 'RulesUpdated' | 'AgentKeyRotated' | 'Swept' | 'Withdrawn' | 'Funded';
  agentKey?: `0x${string}`;
  recipient?: `0x${string}`;
  amountUsdc?: number;
  actionType?: number;
  reasonOrdinal?: number;
  reasonCode?: string;
  txHash: `0x${string}`;
  blockNumber: number;
  timestamp: string;
}

export interface DbSchema {
  workspaces: Workspace[];
  users: User[];
  agents: Agent[];
  vaults: VaultRecord[];
  managedSigners: ManagedSignerRecord[];
  payees: PayeeRecord[];
  apiKeys: ApiKeyRecord[];
  paymentRequests: PaymentRequestRecord[];
  chainEvents: ChainEventRecord[];
}

const DB_FILE = path.join(process.cwd(), 'data', 'db.json');

class DatabaseStore {
  private data: DbSchema;

  constructor() {
    this.data = this.load();
    if (this.data.workspaces.length === 0) {
      this.seedDefaults();
    }
    this.normalizeVaults();
    this.ensureDemoData();
  }

  /** Backfill mode for vaults created before the integrity fix. */
  private normalizeVaults(): void {
    let dirty = false;
    for (const v of this.data.vaults) {
      if (!v.mode) {
        // Unknown historical addresses: treat as offline unless explicitly marked live via env later.
        (v as VaultRecord).mode = 'offline';
        dirty = true;
      }
    }
    if (dirty) this.save();
  }

  private ensureDemoData(): void {
    const wsId = 'ws_default';
    const agentId = 'ag_demo';
    const vaultId = 'v_demo';
    const demoRawKey = 'pb_live_demo1234567890abcdef1234567890abcdef';
    const demoKeyHash = crypto.createHash('sha256').update(demoRawKey).digest('hex');

    if (!this.getApiKeyByHash(demoKeyHash)) {
      this.data.apiKeys.push({
        id: 'key_demo',
        workspaceId: wsId,
        agentId: agentId,
        keyPrefix: 'pb_live_demo',
        keyHash: demoKeyHash,
        name: 'Demo Agent API Key',
        status: 'active',
        createdAt: new Date().toISOString()
      });
    }

    // Ensure demo agent exists
    if (!this.data.agents.find(a => a.id === agentId)) {
      this.data.agents.push({
        id: agentId,
        workspaceId: wsId,
        name: 'Research Assistant Agent',
        description: 'Autonomous research agent paying for APIs & datasets',
        framework: 'langchain',
        status: 'active',
        createdAt: new Date().toISOString()
      });
    }

    // Ensure offline demo vault exists (honest mode — no fabricated chain success)
    if (!this.data.vaults.find(v => v.id === vaultId || v.agentId === agentId)) {
      this.data.vaults.push({
        id: vaultId,
        workspaceId: wsId,
        agentId,
        // Deterministic offline placeholder — never claimed as a live Arc vault tx target for EXECUTED
        address: '0x0000000000000000000000000000000000pb0001' as `0x${string}`,
        ownerAddress: '0x0000000000000000000000000000000000own001' as `0x${string}`,
        agentSignerAddress: '0x0000000000000000000000000000000000sig001' as `0x${string}`,
        treasuryAddress: '0x0000000000000000000000000000000000own001' as `0x${string}`,
        dailyCapUsdc: 100.0,
        perTxCapUsdc: 25.0,
        allowedActionsBitmap: 255,
        agentKeyExpiresAt: Math.floor(Date.now() / 1000) + 365 * 24 * 3600,
        paused: false,
        mode: 'offline',
        createdAt: new Date().toISOString()
      });
    }

    // Ensure mode and defaults are set for all seeded vaults
    for (const v of this.data.vaults) {
      if (!v.mode) v.mode = 'offline';
      if (!v.treasuryAddress) v.treasuryAddress = v.ownerAddress;
    }

    this.save();
  }

  private load(): DbSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const content = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(content);
      }
    } catch (err) {
      console.warn('[DB] Failed to load db file, initializing clean database:', err);
    }
    return {
      workspaces: [],
      users: [],
      agents: [],
      vaults: [],
      managedSigners: [],
      payees: [],
      apiKeys: [],
      paymentRequests: [],
      chainEvents: []
    };
  }

  public save(): void {
    try {
      const dir = path.dirname(DB_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[DB] Save error:', err);
    }
  }

  private seedDefaults(): void {
    const wsId = 'ws_default';
    const agentId = 'ag_demo';
    const vaultId = 'v_demo';

    this.data.workspaces.push({
      id: wsId,
      name: 'Default Workspace',
      slug: 'default',
      createdAt: new Date().toISOString()
    });

    this.data.users.push({
      id: 'u_admin',
      workspaceId: wsId,
      email: 'admin@peribolos.io',
      name: 'Peribolos Admin',
      role: 'owner',
      createdAt: new Date().toISOString()
    });

    this.data.agents.push({
      id: agentId,
      workspaceId: wsId,
      name: 'Research Assistant Agent',
      description: 'Autonomous research agent paying for APIs & datasets',
      framework: 'langchain',
      status: 'active',
      createdAt: new Date().toISOString()
    });

    this.data.vaults.push({
      id: vaultId,
      workspaceId: wsId,
      agentId,
      address: '0x0000000000000000000000000000000000000001',
      ownerAddress: '0x0000000000000000000000000000000000000002',
      agentSignerAddress: '0x0000000000000000000000000000000000000003',
      treasuryAddress: '0x0000000000000000000000000000000000000002',
      dailyCapUsdc: 100.0,
      perTxCapUsdc: 25.0,
      allowedActionsBitmap: 255,
      agentKeyExpiresAt: Math.floor(Date.now() / 1000) + 365 * 24 * 3600,
      paused: false,
      mode: 'offline',
      createdAt: new Date().toISOString()
    });

    this.data.payees.push(
      {
        id: 'pay_x402_seller',
        workspaceId: wsId,
        name: 'Demo x402 Seller API',
        address: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
        category: 'api',
        description: 'x402 HTTP 402 data seller API',
        allowedActionType: 1,
        defaultLimitUsdc: 5.0,
        verified: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'pay_compute_node',
        workspaceId: wsId,
        name: 'Decentralized Compute Provider',
        address: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc',
        category: 'compute',
        description: 'GPU Compute cluster for LLM inference',
        allowedActionType: 2,
        defaultLimitUsdc: 25.0,
        verified: true,
        createdAt: new Date().toISOString()
      }
    );

    const demoRawKey = 'pb_live_demo1234567890abcdef1234567890abcdef';
    const demoKeyHash = crypto.createHash('sha256').update(demoRawKey).digest('hex');

    this.data.apiKeys.push({
      id: 'key_demo',
      workspaceId: wsId,
      agentId: agentId,
      keyPrefix: 'pb_live_demo',
      keyHash: demoKeyHash,
      name: 'Demo Agent API Key',
      status: 'active',
      createdAt: new Date().toISOString()
    });

    this.save();
  }

  // Getters & Setters
  public getWorkspaces() { return this.data.workspaces; }
  public getAgents(wsId?: string) {
    return wsId ? this.data.agents.filter(a => a.workspaceId === wsId) : this.data.agents;
  }
  public getVaults(wsId?: string) {
    return wsId ? this.data.vaults.filter(v => v.workspaceId === wsId) : this.data.vaults;
  }
  public getVaultById(id: string) {
    return this.data.vaults.find(v => v.id === id);
  }
  public getVaultByAddress(address: string) {
    return this.data.vaults.find(v => v.address.toLowerCase() === address.toLowerCase());
  }
  public getPayees(wsId?: string) {
    return wsId ? this.data.payees.filter(p => p.workspaceId === wsId) : this.data.payees;
  }
  public getPayeeByAddress(address: string) {
    return this.data.payees.find(p => p.address.toLowerCase() === address.toLowerCase());
  }
  public getApiKeys(wsId?: string) {
    return wsId ? this.data.apiKeys.filter(k => k.workspaceId === wsId) : this.data.apiKeys;
  }
  public getPaymentRequests(wsId?: string) {
    return wsId ? this.data.paymentRequests.filter(pr => pr.workspaceId === wsId) : this.data.paymentRequests;
  }
  public getChainEvents() { return this.data.chainEvents; }

  // Record creation methods
  public addAgent(agent: Agent) {
    this.data.agents.push(agent);
    this.save();
  }
  public addVault(vault: VaultRecord) {
    this.data.vaults.push(vault);
    this.save();
  }
  public updateVault(vaultId: string, updates: Partial<VaultRecord>) {
    const idx = this.data.vaults.findIndex(v => v.id === vaultId);
    if (idx !== -1) {
      this.data.vaults[idx] = { ...this.data.vaults[idx], ...updates };
      this.save();
      return this.data.vaults[idx];
    }
    return undefined;
  }
  public addManagedSigner(signer: ManagedSignerRecord) {
    this.data.managedSigners.push(signer);
    this.save();
  }
  public getManagedSignerByAgent(agentId: string) {
    return this.data.managedSigners.find(s => s.agentId === agentId && s.status === 'active');
  }
  public getManagedSignerByVault(vaultId: string) {
    return this.data.managedSigners.find(s => s.vaultId === vaultId && s.status === 'active');
  }
  public revokeManagedSigner(agentId: string): boolean {
    const existing = this.data.managedSigners.find(s => s.agentId === agentId && s.status === 'active');
    if (!existing) return false;
    existing.status = 'revoked';
    existing.rotatedAt = new Date().toISOString();
    this.save();
    return true;
  }
  public addPayee(payee: PayeeRecord) {
    this.data.payees.push(payee);
    this.save();
  }
  public addApiKey(apiKey: ApiKeyRecord) {
    this.data.apiKeys.push(apiKey);
    this.save();
  }
  public getApiKeyByHash(hash: string) {
    return this.data.apiKeys.find(k => k.keyHash === hash && k.status === 'active');
  }
  public addPaymentRequest(pr: PaymentRequestRecord) {
    this.data.paymentRequests.unshift(pr);
    this.save();
  }
  public getPaymentRequestByIdempotency(wsId: string, idempotencyKey: string) {
    return this.data.paymentRequests.find(pr => pr.workspaceId === wsId && pr.idempotencyKey === idempotencyKey);
  }
  public addChainEvent(evt: ChainEventRecord) {
    // Avoid duplicate event insertions by txHash + eventType
    const exists = this.data.chainEvents.some(e => e.txHash === evt.txHash && e.eventType === evt.eventType);
    if (!exists) {
      this.data.chainEvents.unshift(evt);
      this.save();
    }
  }
}

export const db = new DatabaseStore();
