import { useEffect, useMemo, useRef, useState } from "react";
import AddTaskForm from "./components/AddTaskForm";
import Filters from "./components/Filters";
import TaskList from "./components/TaskList";
import {
  fetchRepositoryJsonFile,
  getDefaultSyncSettings,
  updateRepositoryJsonFile,
} from "./logic/api";
import { sortTasks } from "./logic/priorityEngine";
import { applyManualOrder, clearManualOrder, reflowTasks } from "./logic/reflowEngine";
import { loadSyncSettings, saveSyncSettings } from "./logic/storage";
import type {
  AppConfig,
  StatusMessage,
  SyncSettings,
  Task,
  TaskDraft,
  TaskFilters,
  TasksFile,
} from "./types";

const defaultFilters: TaskFilters = {
  context: "all",
  importance: "all",
  moods: [],
};

const defaultConfig: AppConfig = {
  moods: ["practical", "creative", "low-effort"],
  maxVisible: 10,
};

function getNow(): string {
  return new Date().toISOString();
}

function getIsOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

async function fetchStaticJson<T>(path: string): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}${path}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Unable to load ${path}.`);
  }

  return (await response.json()) as T;
}

function hasRepoSettings(settings: SyncSettings): boolean {
  return Boolean(settings.owner && settings.repo && settings.branch);
}

function canSync(settings: SyncSettings): boolean {
  return getIsOnline() && Boolean(settings.token) && hasRepoSettings(settings);
}

function buildInitialSyncSettings(): SyncSettings {
  const defaults = getDefaultSyncSettings();
  const stored = loadSyncSettings();

  return {
    ...defaults,
    ...stored,
    owner: stored.owner || defaults.owner,
    repo: stored.repo || defaults.repo,
    branch: stored.branch || defaults.branch,
    tasksPath: stored.tasksPath || defaults.tasksPath,
    configPath: stored.configPath || defaults.configPath,
    token: stored.token || "",
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred.";
}

function isConflictError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("409") ||
    message.includes("does not match") ||
    message.includes("sha")
  );
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

export default function App() {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filters, setFilters] = useState<TaskFilters>(defaultFilters);
  const [status, setStatus] = useState<StatusMessage>({
    tone: "info",
    message: "Loading Top 10 Tasks.",
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSettings, setSyncSettings] = useState<SyncSettings>(buildInitialSyncSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const syncInFlightRef = useRef(false);

  const allRankedTasks = useMemo(
    () => sortTasks(tasks, defaultFilters, config),
    [config, tasks],
  );
  const rankedTasks = useMemo(
    () => sortTasks(tasks, filters, config),
    [config, filters, tasks],
  );
  const visibleTasks = useMemo(
    () => rankedTasks.slice(0, config.maxVisible || 10),
    [config.maxVisible, rankedTasks],
  );
  const hasManualOrder = useMemo(
    () => tasks.some((task) => Number.isInteger(task.manualOrder)),
    [tasks],
  );
  const canMutate = canSync(syncSettings) && !isSyncing;

  useEffect(() => {
    saveSyncSettings(syncSettings);
  }, [syncSettings]);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        const [staticConfig, staticTasks] = await Promise.all([
          fetchStaticJson<AppConfig>("data/config.json"),
          fetchStaticJson<TasksFile>("data/tasks.json"),
        ]);

        if (cancelled) {
          return;
        }

        const fallbackTasks = reflowTasks(staticTasks.tasks ?? [], {
          config: staticConfig,
        });

        setConfig(staticConfig);
        setTasks(fallbackTasks);

        if (canSync(syncSettings)) {
          await refreshFromRemote(false);
          return;
        }

        setStatus({
          tone: "info",
          message: getIsOnline()
            ? "Open Settings and add a GitHub token to work against the private repository."
            : "Offline. Showing bundled fallback tasks only.",
        });
      } catch (error) {
        if (!cancelled) {
          setStatus({
            tone: "error",
            message: getErrorMessage(error),
          });
        }
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!canSync(syncSettings)) {
      return;
    }

    void refreshFromRemote(false);
  }, [syncSettings.token, syncSettings.owner, syncSettings.repo, syncSettings.branch]);

  useEffect(() => {
    function handleOnline() {
      setStatus({
        tone: "info",
        message: canSync(syncSettings)
          ? "Back online. Refreshing private repository state."
          : "Back online. Add your token in Settings to enable private repository sync.",
      });

      if (canSync(syncSettings)) {
        void refreshFromRemote(false);
      }
    }

    function handleOffline() {
      setStatus({
        tone: "info",
        message: "Offline. Changes are disabled until the private repository is reachable.",
      });
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncSettings]);

  async function fetchRemoteState() {
    const [remoteTasksFile, remoteConfigFile] = await Promise.all([
      fetchRepositoryJsonFile<TasksFile>(
        syncSettings,
        syncSettings.tasksPath,
        syncSettings.token,
      ),
      fetchRepositoryJsonFile<AppConfig>(
        syncSettings,
        syncSettings.configPath,
        syncSettings.token,
      ),
    ]);

    const remoteConfig = remoteConfigFile.content;
    const remoteTasks = reflowTasks(remoteTasksFile.content.tasks ?? [], {
      config: remoteConfig,
    });

    return {
      config: remoteConfig,
      tasks: remoteTasks,
      sha: remoteTasksFile.sha,
    };
  }

  async function refreshFromRemote(showSuccessMessage: boolean) {
    if (syncInFlightRef.current || !canSync(syncSettings)) {
      return;
    }

    syncInFlightRef.current = true;
    setIsSyncing(true);

    try {
      const remoteState = await fetchRemoteState();
      setConfig(remoteState.config);
      setTasks(remoteState.tasks);

      if (showSuccessMessage) {
        setStatus({
          tone: "success",
          message: "Private repository refreshed.",
        });
      } else {
        setStatus({
          tone: "info",
          message: "Showing live data from the private repository.",
        });
      }
    } catch (error) {
      setStatus({
        tone: "error",
        message: getErrorMessage(error),
      });
    } finally {
      syncInFlightRef.current = false;
      setIsSyncing(false);
    }
  }

  async function runRemoteTaskMutation(
    buildNextTasks: (remoteTasks: Task[], remoteConfig: AppConfig) => Task[],
    successMessage: string,
  ) {
    if (syncInFlightRef.current) {
      return;
    }

    if (!hasRepoSettings(syncSettings)) {
      setStatus({
        tone: "error",
        message: "Open Settings and set the private data repository owner, name, and branch.",
      });
      return;
    }

    if (!syncSettings.token) {
      setStatus({
        tone: "error",
        message: "Open Settings and add a GitHub token before making task changes.",
      });
      return;
    }

    if (!getIsOnline()) {
      setStatus({
        tone: "error",
        message: "You are offline. Changes are disabled until the private repository is reachable.",
      });
      return;
    }

    syncInFlightRef.current = true;
    setIsSyncing(true);
    setStatus({
      tone: "info",
      message: "Saving to the private repository.",
    });

    try {
      let lastError: unknown = null;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          const remoteState = await fetchRemoteState();
          const nextTasks = reflowTasks(
            buildNextTasks(remoteState.tasks, remoteState.config),
            { config: remoteState.config },
          );

          await updateRepositoryJsonFile(
            syncSettings,
            syncSettings.tasksPath,
            { tasks: nextTasks },
            remoteState.sha,
            syncSettings.token,
            "Sync tasks from PWA",
          );

          setConfig(remoteState.config);
          setTasks(nextTasks);
          setStatus({
            tone: "success",
            message: successMessage,
          });
          return;
        } catch (error) {
          lastError = error;

          if (isConflictError(error) && attempt < 4) {
            await wait(500 * (attempt + 1));
            continue;
          }

          throw error;
        }
      }

      throw lastError;
    } catch (error) {
      if (isConflictError(error)) {
        try {
          const remoteState = await fetchRemoteState();
          setConfig(remoteState.config);
          setTasks(remoteState.tasks);
        } catch {
          // Preserve the original conflict error if the follow-up refresh also fails.
        }
      }

      setStatus({
        tone: "error",
        message: isConflictError(error)
          ? "Another process kept updating the private repository during save. The app refreshed to the latest remote state."
          : getErrorMessage(error),
      });
    } finally {
      syncInFlightRef.current = false;
      setIsSyncing(false);
    }
  }

  function handleAddTask(draft: TaskDraft) {
    const now = getNow();
    const task: Task = {
      id: crypto.randomUUID(),
      ...draft,
      skipped: false,
      createdAt: now,
      updatedAt: now,
      manualOrder: null,
    };

    void runRemoteTaskMutation(
      (remoteTasks) => [...remoteTasks, task],
      "Task saved to the private repository.",
    );
  }

  function handleEditTask(taskId: string, draft: TaskDraft) {
    void runRemoteTaskMutation(
      (remoteTasks) =>
        remoteTasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                ...draft,
                updatedAt: getNow(),
              }
            : task,
        ),
      "Task changes saved to the private repository.",
    );
  }

  function handleComplete(taskId: string) {
    void runRemoteTaskMutation(
      (remoteTasks) => remoteTasks.filter((task) => task.id !== taskId),
      "Task completed and saved.",
    );
  }

  function handleSkip(taskId: string) {
    void runRemoteTaskMutation(
      (remoteTasks) =>
        remoteTasks.map((task) =>
          task.id === taskId
            ? { ...task, skipped: true, updatedAt: getNow() }
            : task,
        ),
      "Task skipped and saved.",
    );
  }

  function handleUnskip(taskId: string) {
    void runRemoteTaskMutation(
      (remoteTasks) =>
        remoteTasks.map((task) =>
          task.id === taskId
            ? { ...task, skipped: false, updatedAt: getNow() }
            : task,
        ),
      "Skip reset and saved.",
    );
  }

  function handleMoveTask(fromId: string, toId: string) {
    void runRemoteTaskMutation((remoteTasks, remoteConfig) => {
      const remoteVisible = sortTasks(remoteTasks, filters, remoteConfig).slice(
        0,
        remoteConfig.maxVisible,
      );
      const remoteVisibleIds = new Set(remoteVisible.map((task) => task.id));
      const fromIndex = remoteVisible.findIndex((task) => task.id === fromId);
      const toIndex = remoteVisible.findIndex((task) => task.id === toId);

      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
        return remoteTasks;
      }

      const nextVisible = [...remoteVisible];
      const [moved] = nextVisible.splice(fromIndex, 1);
      nextVisible.splice(toIndex, 0, moved);

      const remainder = sortTasks(remoteTasks, defaultFilters, remoteConfig).filter(
        (task) => !remoteVisibleIds.has(task.id),
      );

      return applyManualOrder([...nextVisible, ...remainder]);
    }, "Manual order saved.");
  }

  function handleMoveDirection(taskId: string, delta: number) {
    const currentIndex = visibleTasks.findIndex((task) => task.id === taskId);
    const nextIndex = currentIndex + delta;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= visibleTasks.length) {
      return;
    }

    handleMoveTask(taskId, visibleTasks[nextIndex].id);
  }

  function handleClearManualOrder() {
    void runRemoteTaskMutation(
      (remoteTasks, remoteConfig) =>
        reflowTasks(clearManualOrder(remoteTasks), { config: remoteConfig }),
      "Automatic ordering restored.",
    );
  }

  return (
    <main className="app-shell compact-shell">
      <header className="topbar">
        <div className="topbar-copy">
          <h1>Top 10 Tasks</h1>
          <p className="small muted">Live sync to the private repository on every change.</p>
        </div>

        <div className="topbar-actions">
          <span className={`sync-chip ${isSyncing ? "busy" : ""}`}>
            {isSyncing ? "Saving..." : getIsOnline() ? "Online" : "Offline"}
          </span>
          <button
            className="menu-button"
            type="button"
            aria-label="Open settings"
            onClick={() => setIsSettingsOpen((current) => !current)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>

      <div className={`status-banner ${status.tone} compact-status`}>{status.message}</div>

      {isSettingsOpen ? (
        <section className="panel settings-panel" aria-labelledby="settings-heading">
          <div className="label-row">
            <h2 id="settings-heading">Settings</h2>
            <button
              className="button ghost compact-button"
              type="button"
              onClick={() => setIsSettingsOpen(false)}
            >
              Close
            </button>
          </div>

          <div className="token-grid">
            <label className="field-group">
              <span>Data repository owner</span>
              <input
                type="text"
                value={syncSettings.owner}
                onChange={(event) =>
                  setSyncSettings((current) => ({
                    ...current,
                    owner: event.target.value.trim(),
                  }))
                }
              />
            </label>

            <label className="field-group">
              <span>Private data repository</span>
              <input
                type="text"
                value={syncSettings.repo}
                placeholder="todo-app"
                onChange={(event) =>
                  setSyncSettings((current) => ({
                    ...current,
                    repo: event.target.value.trim(),
                  }))
                }
              />
            </label>

            <label className="field-group">
              <span>Branch</span>
              <input
                type="text"
                value={syncSettings.branch}
                onChange={(event) =>
                  setSyncSettings((current) => ({
                    ...current,
                    branch: event.target.value.trim(),
                  }))
                }
              />
            </label>

            <label className="field-group">
              <span>GitHub token</span>
              <input
                type="password"
                value={syncSettings.token}
                placeholder="Stored in this browser only"
                onChange={(event) =>
                  setSyncSettings((current) => ({
                    ...current,
                    token: event.target.value.trim(),
                  }))
                }
              />
            </label>
          </div>

          <div className="action-row">
            <button
              className="button compact-button"
              type="button"
              disabled={isSyncing || !canSync(syncSettings)}
              onClick={() => void refreshFromRemote(true)}
            >
              Refresh
            </button>
            <span className="small muted">
              Reads and writes <code>{syncSettings.tasksPath}</code> in
              <code> {syncSettings.repo}</code>.
            </span>
          </div>
        </section>
      ) : null}

      <TaskList
        tasks={visibleTasks}
        maxVisible={config.maxVisible}
        moods={config.moods}
        disabled={!canMutate}
        onComplete={handleComplete}
        onSkip={handleSkip}
        onUnskip={handleUnskip}
        onMoveTask={handleMoveTask}
        onMoveDirection={handleMoveDirection}
        onSaveEdit={handleEditTask}
      />

      <section className="utility-strip">
        <button
          className="button secondary compact-button"
          type="button"
          onClick={() => setIsComposerOpen((current) => !current)}
        >
          {isComposerOpen ? "Hide add" : "New task"}
        </button>
        <button
          className="button secondary compact-button"
          type="button"
          onClick={() => setIsFiltersOpen((current) => !current)}
        >
          {isFiltersOpen ? "Hide filters" : "Filters"}
        </button>
      </section>

      {isFiltersOpen ? (
        <Filters
          filters={filters}
          moods={config.moods}
          hasManualOrder={hasManualOrder}
          disabled={isSyncing}
          onChange={setFilters}
          onReset={() => setFilters(defaultFilters)}
          onClearManualOrder={handleClearManualOrder}
        />
      ) : null}

      {isComposerOpen ? (
        <AddTaskForm
          moods={config.moods}
          disabled={!canMutate}
          onAddTask={handleAddTask}
        />
      ) : null}
    </main>
  );
}
