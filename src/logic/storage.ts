import type { AppConfig, PendingChange, SyncSettings, Task } from "../types";

const TASKS_CACHE_KEY = "todo-app/tasks";
const CONFIG_CACHE_KEY = "todo-app/config";
const PENDING_CHANGES_KEY = "todo-app/pending-changes";
const SYNC_SETTINGS_KEY = "todo-app/sync-settings";

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

export function loadCachedTasks(): Task[] {
  return readJson<Task[]>(TASKS_CACHE_KEY, []);
}

export function saveCachedTasks(tasks: Task[]): void {
  writeJson(TASKS_CACHE_KEY, tasks);
}

export function loadCachedConfig(): AppConfig | null {
  return readJson<AppConfig | null>(CONFIG_CACHE_KEY, null);
}

export function saveCachedConfig(config: AppConfig): void {
  writeJson(CONFIG_CACHE_KEY, config);
}

export function loadPendingChanges(): PendingChange[] {
  return readJson<PendingChange[]>(PENDING_CHANGES_KEY, []);
}

export function savePendingChanges(changes: PendingChange[]): void {
  writeJson(PENDING_CHANGES_KEY, changes);
}

export function queuePendingChange(change: PendingChange): PendingChange[] {
  const nextChanges = [...loadPendingChanges(), change];
  savePendingChanges(nextChanges);
  return nextChanges;
}

export function clearPendingChanges(): void {
  savePendingChanges([]);
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

export function applyPendingChanges(
  remoteTasks: Task[],
  changes: PendingChange[],
): Task[] {
  let nextTasks = [...remoteTasks];

  for (const change of changes) {
    if (change.type === "replaceAll") {
      nextTasks = [...change.tasks];
      continue;
    }

    if (change.type === "upsert") {
      const index = nextTasks.findIndex((task) => task.id === change.task.id);

      if (index === -1) {
        nextTasks.push(change.task);
      } else {
        nextTasks[index] = change.task;
      }
    }

    if (change.type === "delete") {
      nextTasks = nextTasks.filter((task) => task.id !== change.taskId);
    }
  }

  return nextTasks;
}

