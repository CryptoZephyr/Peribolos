export const WORKSPACE_SETTINGS_STORAGE_KEY = "peribolos.workspace-settings.v1";
export const WORKSPACE_SETTINGS_CHANGED_EVENT = "peribolos-workspace-settings-changed";

export interface WorkspaceSettings {
  workspaceName: string;
  defaultDailyCap: string;
  defaultPerTxCap: string;
}

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  workspaceName: "Arc Primary Workspace",
  defaultDailyCap: "100",
  defaultPerTxCap: "25",
};

export function readWorkspaceSettings(): WorkspaceSettings {
  if (typeof window === "undefined") return DEFAULT_WORKSPACE_SETTINGS;

  try {
    const saved = JSON.parse(window.localStorage.getItem(WORKSPACE_SETTINGS_STORAGE_KEY) || "null");
    if (!saved || typeof saved !== "object") return DEFAULT_WORKSPACE_SETTINGS;
    return {
      ...DEFAULT_WORKSPACE_SETTINGS,
      ...saved,
      workspaceName: typeof saved.workspaceName === "string" ? saved.workspaceName : DEFAULT_WORKSPACE_SETTINGS.workspaceName,
      defaultDailyCap: typeof saved.defaultDailyCap === "string" ? saved.defaultDailyCap : DEFAULT_WORKSPACE_SETTINGS.defaultDailyCap,
      defaultPerTxCap: typeof saved.defaultPerTxCap === "string" ? saved.defaultPerTxCap : DEFAULT_WORKSPACE_SETTINGS.defaultPerTxCap,
    };
  } catch {
    return DEFAULT_WORKSPACE_SETTINGS;
  }
}

export function saveWorkspaceSettings(settings: WorkspaceSettings) {
  window.localStorage.setItem(WORKSPACE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event(WORKSPACE_SETTINGS_CHANGED_EVENT));
}
