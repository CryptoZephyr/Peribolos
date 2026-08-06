"use client";

import { useEffect, useState } from "react";
import {
  Gear,
  ShieldCheck,
  Globe,
  Key,
  Check,
  Trash,
} from "@phosphor-icons/react";
import { useToast } from "@/app/components/Toast";
import { useSupabaseAuth } from "@/app/auth/SupabaseAuthProvider";
import { rpcUrl } from "@/lib/chain";
import {
  DEFAULT_WORKSPACE_SETTINGS,
  saveWorkspaceSettings,
  readWorkspaceSettings,
} from "@/lib/workspace-settings";

export default function WorkspaceSettingsPage() {
  const toast = useToast();
  const { configured, session, registerPasskey, listPasskeys, deletePasskey } = useSupabaseAuth();
  const [activeTab, setActiveTab] = useState<"general" | "security" | "network">("general");

  // Form states
  const [workspaceName, setWorkspaceName] = useState(DEFAULT_WORKSPACE_SETTINGS.workspaceName);
  const [defaultDailyCap, setDefaultDailyCap] = useState(DEFAULT_WORKSPACE_SETTINGS.defaultDailyCap);
  const [defaultPerTxCap, setDefaultPerTxCap] = useState(DEFAULT_WORKSPACE_SETTINGS.defaultPerTxCap);
  const [saving, setSaving] = useState(false);
  const [registeringPasskey, setRegisteringPasskey] = useState(false);
  const [activePasskeys, setActivePasskeys] = useState<Awaited<ReturnType<typeof listPasskeys>>>([]);
  const [loadingPasskeys, setLoadingPasskeys] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);

  async function refreshPasskeys() {
    if (!session) {
      setActivePasskeys([]);
      setPasskeyError(null);
      return;
    }
    setLoadingPasskeys(true);
    setPasskeyError(null);
    try {
      setActivePasskeys(await listPasskeys());
    } catch (error) {
      setPasskeyError(error instanceof Error ? error.message : "Unable to load active passkeys.");
    } finally {
      setLoadingPasskeys(false);
    }
  }

  useEffect(() => {
    if (activeTab !== "security" || !configured) return;
    void refreshPasskeys();
  }, [activeTab, configured, session]);

  useEffect(() => {
    const saved = readWorkspaceSettings();
    setWorkspaceName(saved.workspaceName);
    setDefaultDailyCap(saved.defaultDailyCap);
    setDefaultPerTxCap(saved.defaultPerTxCap);
  }, []);

  async function handleRegisterPasskey() {
    setRegisteringPasskey(true);
    try {
      await registerPasskey();
      await refreshPasskeys();
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
    saveWorkspaceSettings({ workspaceName, defaultDailyCap, defaultPerTxCap });
    setSaving(false);
    toast.success("Preferences saved", "New vaults will use these caps in this browser.");
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
          Manage workspace defaults and connection details for this browser session.
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
      </div>

      {/* Tab Panels */}
      <form onSubmit={handleSave} className="app-panel p-6 space-y-6 max-w-3xl">
        {activeTab === "general" && (
          <div className="space-y-5">
            <div>
          <h2 className="text-base font-semibold text-text">General Workspace Defaults</h2>
              <p className="text-xs text-text-muted mt-1">Set the values you want to reuse when provisioning a new vault.</p>
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
              <h2 className="text-base font-semibold text-text">Security & sign-in</h2>
              <p className="text-xs text-text-muted mt-1">Manage passkeys for this workspace. Contract controls remain owner-authorized or server-enforced.</p>
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
                disabled={!configured || !session || registeringPasskey}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-text px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Key size={14} weight="bold" />
                {registeringPasskey ? "Registering..." : "Register this device"}
              </button>
            </div>

            <div className="rounded-xl border border-line bg-surface-raised p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={17} weight="bold" className="text-accent" />
                    <h3 className="text-sm font-semibold text-text">Active passkeys</h3>
                    {!loadingPasskeys && (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                        {activePasskeys.length} {activePasskeys.length === 1 ? "device" : "devices"}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-text-muted">
                    Review the devices that can sign in without an email link. Remove one if it is no longer trusted.
                  </p>
                </div>
                {session && (
                  <button
                    type="button"
                    onClick={() => void refreshPasskeys()}
                    disabled={loadingPasskeys}
                    className="self-start rounded-lg border border-line px-3 py-2 text-[11px] font-semibold text-text-muted transition-colors hover:border-line-strong hover:text-text disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loadingPasskeys ? "Refreshing..." : "Refresh"}
                  </button>
                )}
              </div>

              {!session ? (
                <div className="mt-4 rounded-lg border border-dashed border-line px-3 py-3 text-xs text-text-muted">
                  Sign in with email first to view and manage passkeys for this account.
                </div>
              ) : loadingPasskeys ? (
                <div className="mt-4 space-y-2" aria-label="Loading active passkeys">
                  <div className="h-12 animate-pulse rounded-lg bg-surface" />
                  <div className="h-12 animate-pulse rounded-lg bg-surface" />
                </div>
              ) : passkeyError ? (
                <div className="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-3 text-xs text-rose-300">
                  {passkeyError}
                </div>
              ) : activePasskeys.length === 0 ? (
                <div className="mt-4 rounded-lg border border-dashed border-line px-3 py-3 text-xs text-text-muted">
                  No passkeys are registered yet. Register this device to make your next sign-in instant.
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {activePasskeys.map((passkey) => (
                    <div key={passkey.id} className="flex flex-col gap-3 rounded-lg border border-line bg-surface px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                          <Key size={15} weight="bold" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-text">{passkey.friendly_name || "Passkey device"}</p>
                          <p className="mt-0.5 text-[11px] text-text-muted">
                            Added {formatPasskeyDate(passkey.created_at)}
                            {passkey.last_used_at ? ` · Last used ${formatPasskeyDate(passkey.last_used_at)}` : ""}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await deletePasskey(passkey.id);
                            setActivePasskeys((current) => current.filter((item) => item.id !== passkey.id));
                            toast.success("Passkey removed", "This device can no longer sign in with that passkey.");
                          } catch (error) {
                            toast.error("Could not remove passkey", error instanceof Error ? error.message : "Try again shortly.");
                          }
                        }}
                        className="inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-lg border border-line px-3 py-2 text-[11px] font-semibold text-text-muted transition-colors hover:border-rose-500/40 hover:text-rose-300 sm:self-auto"
                      >
                        <Trash size={14} />
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
                  readOnly
                  className="w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-xs text-text focus:border-accent focus:outline-none font-mono"
                />
                <p className="mt-1 text-[11px] text-text-muted">This endpoint is supplied by the dashboard environment and is read-only here.</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-text-muted">Saved on this browser; these preferences do not change on-chain policy.</p>
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

function formatPasskeyDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}
