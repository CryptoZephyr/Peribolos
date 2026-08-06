import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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
  externalAuthId?: string;
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
  /** Circle wallet id when provider is circle; empty for legacy local signers. */
  walletId?: string;
  provider?: 'circle' | 'local';
  encryptedPrivateKey?: string; // AES-256-GCM (legacy/local fallback)
  iv?: string;
  authTag?: string;
  status: 'active' | 'pending' | 'rotated' | 'revoked';
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
  /** operator keys manage a workspace; agent keys are payment-only credentials. */
  role?: 'operator' | 'agent';
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

export const DB_FILE = process.env.PERIBOLOS_DB_FILE || path.join(process.cwd(), 'data', 'db.json');
const SUPABASE_STATE_TABLE = 'peribolos_state';
const SUPABASE_STATE_ID = 'primary';

function shouldSeedDemoData(): boolean {
  return process.env.NODE_ENV === 'test'
    || (process.env.NODE_ENV === 'development' && process.env.PERIBOLOS_SEED_DEMO === '1');
}

function testApiKey(): string | undefined {
  return process.env.NODE_ENV === 'test' ? process.env.PERIBOLOS_TEST_API_KEY?.trim() : undefined;
}

function emptyDbSchema(): DbSchema {
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

export type PersistenceStatus = {
  provider: 'supabase' | 'file' | 'unconfigured';
  configured: boolean;
  healthy: boolean;
  lastError?: string;
};

class DatabaseStore {
  private data: DbSchema;
  private readonly supabase: SupabaseClient | null;
  private readonly remotePersistence: boolean;
  private persistenceHealthy: boolean;
  private persistenceError?: string;
  private remoteSaveQueue: Promise<void> = Promise.resolve();

  private constructor(data: DbSchema, supabase: SupabaseClient | null, remotePersistence: boolean, persistenceHealthy = true, persistenceError?: string) {
    this.data = data;
    this.supabase = supabase;
    this.remotePersistence = remotePersistence;
    this.persistenceHealthy = persistenceHealthy;
    this.persistenceError = persistenceError;
    this.initialize();
  }

  public static async create(): Promise<DatabaseStore> {
    const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const wantsRemote = process.env.NODE_ENV === 'production' || process.env.PERIBOLOS_USE_SUPABASE === '1';

    if (!wantsRemote) {
      return new DatabaseStore(DatabaseStore.loadFile(), null, false);
    }

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[DB] Supabase persistence is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      return new DatabaseStore(emptyDbSchema(), null, false, false, 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
    }

    const client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    try {
      const { data, error } = await client
        .from(SUPABASE_STATE_TABLE)
        .select('data')
        .eq('id', SUPABASE_STATE_ID)
        .maybeSingle();
      if (error) throw error;
      return new DatabaseStore((data?.data as DbSchema | null) || emptyDbSchema(), client, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[DB] Supabase state load failed: ${message}`);
      return new DatabaseStore(emptyDbSchema(), client, true, false, message.slice(0, 300));
    }
  }

  private initialize(): void {
    this.normalizeApiKeyRoles();
    if (this.data.workspaces.length === 0 && shouldSeedDemoData()) {
      this.seedDefaults();
    }
    this.normalizeVaults();
    if (shouldSeedDemoData()) {
      this.ensureDemoData();
    } else {
      this.purgeDemoData();
    }
    this.ensureBootstrapApiKey();
  }

  private normalizeApiKeyRoles(): void {
    let changed = false;
    for (const key of this.data.apiKeys) {
      if (!key.role) {
        key.role = key.name.toLowerCase().includes('bootstrap') ? 'operator' : 'agent';
        changed = true;
      }
    }
    if (changed) this.save();
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
    const rawTestKey = testApiKey();
    if (rawTestKey && !this.getApiKeyByHash(crypto.createHash('sha256').update(rawTestKey).digest('hex'))) {
      this.data.apiKeys.push({
        id: 'key_test',
        workspaceId: wsId,
        agentId: agentId,
        keyPrefix: rawTestKey.substring(0, 12),
        keyHash: crypto.createHash('sha256').update(rawTestKey).digest('hex'),
        name: 'Test Operator API Key',
        role: 'operator',
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

  private static loadFile(): DbSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const content = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(content);
      }
    } catch (err) {
      console.warn('[DB] Failed to load db file, initializing clean database:', err);
    }
    return emptyDbSchema();
  }

  public save(): void {
    if (this.remotePersistence && this.supabase) {
      const client = this.supabase;
      const snapshot = JSON.parse(JSON.stringify(this.data)) as DbSchema;
      this.remoteSaveQueue = this.remoteSaveQueue
        .then(async () => {
          const { error } = await client
            .from(SUPABASE_STATE_TABLE)
            .upsert({
              id: SUPABASE_STATE_ID,
              data: snapshot,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'id' });
          if (error) throw error;
          this.persistenceHealthy = true;
          this.persistenceError = undefined;
        })
        .catch((error: unknown) => {
          this.persistenceHealthy = false;
          this.persistenceError = (error instanceof Error ? error.message : String(error)).slice(0, 300);
          console.error(`[DB] Supabase state save failed: ${this.persistenceError}`);
        });
      return;
    }

    if (process.env.NODE_ENV === 'production') return;
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

  public getPersistenceStatus(): PersistenceStatus {
    if (this.remotePersistence) {
      return {
        provider: 'supabase',
        configured: Boolean(this.supabase),
        healthy: this.persistenceHealthy,
        lastError: this.persistenceError,
      };
    }
    if (process.env.NODE_ENV === 'production') {
      return {
        provider: 'unconfigured',
        configured: false,
        healthy: false,
        lastError: this.persistenceError,
      };
    }
    return { provider: 'file', configured: true, healthy: true };
  }

  public getOrCreateExternalWorkspace(externalAuthId: string, email: string): string {
    const existing = this.data.users.find((user) => user.externalAuthId === externalAuthId);
    if (existing) return existing.workspaceId;
    const workspaceId = `ws_${crypto.createHash('sha256').update(externalAuthId).digest('hex').slice(0, 16)}`;
    if (!this.data.workspaces.some((workspace) => workspace.id === workspaceId)) {
      this.data.workspaces.push({
        id: workspaceId,
        name: `${email.split('@')[0] || 'New'} Workspace`,
        slug: workspaceId.slice(3),
        createdAt: new Date().toISOString(),
      });
    }
    this.data.users.push({
      id: `user_${externalAuthId.slice(0, 20)}`,
      workspaceId,
      email,
      name: email.split('@')[0] || 'Workspace owner',
      role: 'owner',
      externalAuthId,
      createdAt: new Date().toISOString(),
    });
    this.save();
    return workspaceId;
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

    const rawTestKey = testApiKey();
    if (rawTestKey) {
      this.data.apiKeys.push({
        id: 'key_test',
        workspaceId: wsId,
        agentId: agentId,
        keyPrefix: rawTestKey.substring(0, 12),
        keyHash: crypto.createHash('sha256').update(rawTestKey).digest('hex'),
        name: 'Test Operator API Key',
        role: 'operator',
        status: 'active',
        createdAt: new Date().toISOString()
      });
    }

    this.save();
  }

  private purgeDemoData(): void {
    let dirty = false;
    const beforeKeys = this.data.apiKeys.length;
    this.data.apiKeys = this.data.apiKeys.filter(key =>
      key.id !== 'key_demo' && key.id !== 'key_test' && key.keyPrefix !== 'pb_live_demo'
    );
    dirty ||= beforeKeys !== this.data.apiKeys.length;
    const beforeAgents = this.data.agents.length;
    this.data.agents = this.data.agents.filter(agent => agent.id !== 'ag_demo');
    dirty ||= beforeAgents !== this.data.agents.length;
    const beforeVaults = this.data.vaults.length;
    this.data.vaults = this.data.vaults.filter(vault => vault.id !== 'v_demo');
    dirty ||= beforeVaults !== this.data.vaults.length;
    const beforePayees = this.data.payees.length;
    this.data.payees = this.data.payees.filter(payee => !['pay_x402_seller', 'pay_compute_node'].includes(payee.id));
    dirty ||= beforePayees !== this.data.payees.length;
    const beforeUsers = this.data.users.length;
    this.data.users = this.data.users.filter(user => user.id !== 'u_admin' && user.email !== 'admin@peribolos.io');
    dirty ||= beforeUsers !== this.data.users.length;
    const defaultWorkspace = this.data.workspaces.find(workspace => workspace.id === 'ws_default');
    if (defaultWorkspace && !this.data.users.some(user => user.workspaceId === defaultWorkspace.id)
      && !this.data.agents.some(agent => agent.workspaceId === defaultWorkspace.id)
      && !this.data.vaults.some(vault => vault.workspaceId === defaultWorkspace.id)
      && !this.data.payees.some(payee => payee.workspaceId === defaultWorkspace.id)
      && !this.data.apiKeys.some(key => key.workspaceId === defaultWorkspace.id)) {
      this.data.workspaces = this.data.workspaces.filter(workspace => workspace.id !== defaultWorkspace.id);
      dirty = true;
    }
    if (dirty) this.save();
  }

  private ensureBootstrapApiKey(): void {
    const rawKey = process.env.PERIBOLOS_BOOTSTRAP_API_KEY?.trim();
    if (!rawKey) return;

    const workspaceId = process.env.PERIBOLOS_BOOTSTRAP_WORKSPACE_ID || 'ws_default';
    const agentId = process.env.PERIBOLOS_BOOTSTRAP_AGENT_ID || 'ag_bootstrap';
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    if (this.getApiKeyByHash(keyHash)) return;

    if (!this.data.workspaces.find(workspace => workspace.id === workspaceId)) {
      this.data.workspaces.push({
        id: workspaceId,
        name: 'Bootstrap Workspace',
        slug: workspaceId.replace(/^ws_/, '').toLowerCase(),
        createdAt: new Date().toISOString()
      });
    }

    if (!this.data.agents.find(a => a.id === agentId)) {
      this.data.agents.push({
        id: agentId,
        workspaceId,
        name: 'Bootstrap Admin Agent',
        description: 'Operator-provided bootstrap API principal',
        framework: 'custom',
        status: 'active',
        createdAt: new Date().toISOString()
      });
    }

    this.data.apiKeys.push({
      id: `key_bootstrap_${crypto.randomBytes(4).toString('hex')}`,
      workspaceId,
      agentId,
      keyPrefix: rawKey.substring(0, 12),
      keyHash,
      name: 'Bootstrap API Key',
      role: 'operator',
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
  public getPayeeByAddress(address: string, wsId?: string) {
    return this.data.payees.find(p =>
      p.address.toLowerCase() === address.toLowerCase() &&
      (!wsId || p.workspaceId === wsId)
    );
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
  public getManagedSignerByAddress(address: string, status?: ManagedSignerRecord['status']) {
    const normalized = address.toLowerCase();
    return this.data.managedSigners.find(s =>
      s.address.toLowerCase() === normalized && (!status || s.status === status)
    );
  }
  public promoteManagedSigner(agentId: string, address: string): ManagedSignerRecord | undefined {
    const normalized = address.toLowerCase();
    const next = this.data.managedSigners.find(s =>
      s.agentId === agentId && s.address.toLowerCase() === normalized && s.status === 'pending'
    );
    if (!next) return undefined;
    for (const signer of this.data.managedSigners) {
      if (signer.agentId === agentId && signer.status === 'active') {
        signer.status = 'rotated';
        signer.rotatedAt = new Date().toISOString();
      }
    }
    next.status = 'active';
    this.save();
    return next;
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
  public revokeApiKey(workspaceId: string, keyId: string): ApiKeyRecord | undefined {
    const key = this.data.apiKeys.find(k => k.id === keyId && k.workspaceId === workspaceId);
    if (!key) return undefined;
    if (key.status !== 'revoked') {
      key.status = 'revoked';
      this.save();
    }
    return key;
  }
  public addPaymentRequest(pr: PaymentRequestRecord) {
    this.data.paymentRequests.unshift(pr);
    this.save();
  }
  public addPaymentRequestIfAbsent(pr: PaymentRequestRecord) {
    const existing = this.getPaymentRequestByIdempotency(pr.workspaceId, pr.idempotencyKey);
    if (existing) return existing;
    this.data.paymentRequests.unshift(pr);
    this.save();
    return pr;
  }
  public updatePaymentRequest(id: string, updates: Partial<PaymentRequestRecord>) {
    const idx = this.data.paymentRequests.findIndex(pr => pr.id === id);
    if (idx === -1) return undefined;
    this.data.paymentRequests[idx] = {
      ...this.data.paymentRequests[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.save();
    return this.data.paymentRequests[idx];
  }
  public getPaymentRequestByIdempotency(wsId: string, idempotencyKey: string) {
    return this.data.paymentRequests.find(pr => pr.workspaceId === wsId && pr.idempotencyKey === idempotencyKey);
  }
  public addChainEvent(evt: ChainEventRecord) {
    // Avoid duplicate event insertions by stable event id.
    const exists = this.data.chainEvents.some(e => e.id === evt.id);
    if (!exists) {
      this.data.chainEvents.unshift(evt);
      this.save();
    }
  }
}

export const db = await DatabaseStore.create();
