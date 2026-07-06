import type { SyncSettings } from "../types";

const SYNC_SETTINGS_KEY = "todo-app-public/sync-settings";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && "localStorage" in window;
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) {
    return fallback;
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadSyncSettings(): SyncSettings {
  return readJson<SyncSettings>(SYNC_SETTINGS_KEY, {
    token: "",
    owner: "",
    repo: "",
    branch: "main",
    tasksPath: "data/tasks.json",
    configPath: "data/config.json",
  });
}

export function saveSyncSettings(settings: SyncSettings): void {
  writeJson(SYNC_SETTINGS_KEY, settings);
}
