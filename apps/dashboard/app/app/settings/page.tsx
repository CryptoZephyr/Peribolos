"use client";

import { useState } from "react";
import {
  Gear,
  ShieldCheck,
  Bell,
  Globe,
  Key,
  Check,
  LockKey,
  Wallet,
} from "@phosphor-icons/react";
import { useToast } from "@/app/components/Toast";
import { useSupabaseAuth } from "@/app/auth/SupabaseAuthProvider";

export default function WorkspaceSettingsPage() {
  const toast = useToast();
  const { configured, registerPasskey } = useSupabaseAuth();
  const [activeTab, setActiveTab] = useState<"general" | "security" | "network" | "webhooks">("general");

  // Form states
  const [workspaceName, setWorkspaceName] = useState("Arc Primary Workspace");
  const [defaultDailyCap, setDefaultDailyCap] = useState("100");
  const [defaultPerTxCap, setDefaultPerTxCap] = useState("25");
  const [require2FA, setRequire2FA] = useState(true);
  const [autoPauseOnAnomaly, setAutoPauseOnAnomaly] = useState(true);
  const [rpcUrl, setRpcUrl] = useState("https://arc-testnet.rpc.peribolos.io");
  const [webhookUrl, setWebhookUrl] = useState("https://api.peribolos.io/v1/webhooks/alerts");
  const [saving, setSaving] = useState(false);
  const [registeringPasskey, setRegisteringPasskey] = useState(false);

  async function handleRegisterPasskey() {
    setRegisteringPasskey(true);
    try {
      await registerPasskey();
      toast.success("Passkey registered", "This device can now sign in to Peribolos without an email link.");
    } catch (error) {
      toast.error(
        "Passkey registration failed",
        error instanceof Error ? error.message : "Unable to register a passkey on this device.",
      );
    } finally {
      setRegisteringPasskey(false);
    }
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success("Settings Saved", "Workspace policies and preferences updated successfully.");
    }, 400);
  }

  return (
    <div className="space-y-7 animate-in fade-in duration-300">
      {/* Header */}
      <div className="border-b border-line pb-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
          <Gear size={16} weight="bold" />
          <span>Configuration</span>
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-text">Workspace Settings</h1>
        <p className="mt-1 text-sm text-text-muted">
          Manage workspace defaults, contract policy triggers, network RPC endpoints, and alert webhooks.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-line gap-2 overflow-x-auto pb-px">
        <button
          type="button"
          onClick={() => setActiveTab("general")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-all ${
            activeTab === "general"
              ? "border-accent text-accent"
              : "border-transparent text-text-muted hover:text-text"
          }`}
        >
          <Gear size={15} />
          General Defaults
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("security")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-all ${
            activeTab === "security"
              ? "border-accent text-accent"
              : "border-transparent text-text-muted hover:text-text"
          }`}
        >
          <ShieldCheck size={15} />
          Security & Policy Rules
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("network")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-all ${
            activeTab === "network"
              ? "border-accent text-accent"
              : "border-transparent text-text-muted hover:text-text"
          }`}
        >
          <Globe size={15} />
          Arc Network RPC
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("webhooks")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-all ${
            activeTab === "webhooks"
              ? "border-accent text-accent"
              : "border-transparent text-text-muted hover:text-text"
          }`}
        >
          <Bell size={15} />
          Alert Webhooks
        </button>
      </div>

      {/* Tab Panels */}
      <form onSubmit={handleSave} className="app-panel p-6 space-y-6 max-w-3xl">
        {activeTab === "general" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-text">General Workspace Defaults</h2>
              <p className="text-xs text-text-muted mt-1">Configure baseline parameters for newly provisioned vaults.</p>
            </div>

            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-text mb-1.5">Workspace Name</label>
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-xs text-text focus:border-accent focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text mb-1.5">Default Agent Daily Cap (USDC)</label>
                  <input
                    type="number"
                    value={defaultDailyCap}
                    onChange={(e) => setDefaultDailyCap(e.target.value)}
                    className="w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-xs text-text focus:border-accent focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text mb-1.5">Default Per-Tx Cap (USDC)</label>
                  <input
                    type="number"
                    value={defaultPerTxCap}
                    onChange={(e) => setDefaultPerTxCap(e.target.value)}
                    className="w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-xs text-text focus:border-accent focus:outline-none font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "security" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-text">Security & Enforcement Automation</h2>
              <p className="text-xs text-text-muted mt-1">Control contract-level triggers and authentication requirements.</p>
            </div>

            <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface-raised p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <Key size={18} weight="bold" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text">Passkey sign-in</p>
                  <p className="mt-1 max-w-xl text-xs leading-relaxed text-text-muted">
                    Register this device after signing in with email. You can then use Windows Hello, Touch ID, or your passkey manager at login.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRegisterPasskey}
                disabled={!configured || registeringPasskey}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-text px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Key size={14} weight="bold" />
                {registeringPasskey ? "Registering..." : "Register this device"}
              </button>
            </div>

            <div className="space-y-4 pt-2 divide-y divide-line">
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-xs font-semibold text-text">Auto-Pause Vault on Anomaly</p>
                  <p className="text-[11px] text-text-muted">Automatically invoke `pause()` on-chain if 3 consecutive invalid payees are requested.</p>
                </div>
                <input
                  type="checkbox"
                  checked={autoPauseOnAnomaly}
                  onChange={(e) => setAutoPauseOnAnomaly(e.target.checked)}
                  className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
                />
              </div>

              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-xs font-semibold text-text">Require Owner 2FA for Signer Rotation</p>
                  <p className="text-[11px] text-text-muted">Require hardware key confirmation before issuing on-chain `rotateAgentKey` transactions.</p>
                </div>
                <input
                  type="checkbox"
                  checked={require2FA}
                  onChange={(e) => setRequire2FA(e.target.checked)}
                  className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "network" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-text">Arc Network Connection</h2>
              <p className="text-xs text-text-muted mt-1">Configure RPC connection endpoints for Arc Testnet policy verification.</p>
            </div>

            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-text mb-1.5">Arc Testnet RPC Endpoint</label>
                <input
                  type="url"
                  value={rpcUrl}
                  onChange={(e) => setRpcUrl(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-xs text-text focus:border-accent focus:outline-none font-mono"
                />
                <p className="mt-1 text-[11px] text-text-muted">Primary RPC node used for reading on-chain vault state and broadcasting owner calls.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "webhooks" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-text">Alert & Webhook Integration</h2>
              <p className="text-xs text-text-muted mt-1">Receive real-time HTTP POST webhooks when an agent payment is blocked by a policy rule.</p>
            </div>

            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-text mb-1.5">Alert Webhook Endpoint</label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-xs text-text focus:border-accent focus:outline-none font-mono"
                />
                <p className="mt-1 text-[11px] text-text-muted">Payload includes blocked payment details, agent ID, payee address, and failure reason code.</p>
              </div>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-line flex items-center justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-text px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-accent disabled:opacity-60 transition-all"
          >
            {saving ? "Saving..." : "Save Preferences"}
            {!saving && <Check size={14} weight="bold" />}
          </button>
        </div>
      </form>
    </div>
  );
}
