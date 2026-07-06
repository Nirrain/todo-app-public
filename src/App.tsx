import { useEffect, useMemo, useState } from "react";
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
import {
  applyPendingChanges,
  clearPendingChanges,
  loadCachedConfig,
  loadCachedTasks,
  loadPendingChanges,
  loadSyncSettings,
  queuePendingChange,
  saveCachedConfig,
  saveCachedTasks,
  saveSyncSettings,
} from "./logic/storage";
import type {
  AppConfig,
  PendingChange,
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

export default function App() {
  const [config, setConfig] = useState<AppConfig>(loadCachedConfig() ?? defaultConfig);
  const [tasks, setTasks] = useState<Task[]>(loadCachedTasks());
  const [filters, setFilters] = useState<TaskFilters>(defaultFilters);
  const [status, setStatus] = useState<StatusMessage>({
    tone: "info",
    message: "Loading cached tasks and private GitHub data defaults.",
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(loadPendingChanges().length);
  const [syncSettings, setSyncSettings] = useState<SyncSettings>(buildInitialSyncSettings);

  const allRankedTasks = useMemo(() => sortTasks(tasks, defaultFilters, config), [config, tasks]);
  const rankedTasks = useMemo(() => sortTasks(tasks, filters, config), [config, filters, tasks]);
  const visibleTasks = useMemo(
    () => rankedTasks.slice(0, config.maxVisible || 10),
    [config.maxVisible, rankedTasks],
  );
  const hasManualOrder = useMemo(
    () => tasks.some((task) => Number.isInteger(task.manualOrder)),
    [tasks],
  );

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

        const normalizedTasks = reflowTasks(staticTasks.tasks ?? [], {
          config: staticConfig,
        });

        setConfig(staticConfig);
        saveCachedConfig(staticConfig);
        setTasks((currentTasks) => {
          const nextTasks = currentTasks.length > 0 ? currentTasks : normalizedTasks;
          saveCachedTasks(nextTasks);
          return nextTasks;
        });
        setStatus({
          tone: "info",
          message: getIsOnline()
            ? "Ready. Local cache loaded from the public app bundle."
            : "Offline mode active. Using cached task data.",
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
    if (!getIsOnline() || !syncSettings.token || !hasRepoSettings(syncSettings)) {
      return;
    }

    void handleSync(false);
  }, [syncSettings.token, syncSettings.owner, syncSettings.repo, syncSettings.branch]);

  useEffect(() => {
    function handleOnline() {
      setStatus({
        tone: "info",
        message: "Connection restored. Private repository sync is available.",
      });

      if (loadPendingChanges().length > 0 && syncSettings.token && hasRepoSettings(syncSettings)) {
        void handleSync(true);
      }
    }

    function handleOffline() {
      setStatus({
        tone: "info",
        message: "Offline mode active. Changes will stay cached until sync succeeds.",
      });
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncSettings]);

  function commitTaskState(nextTasks: Task[], change: PendingChange | null, message: string) {
    const reflowed = reflowTasks(nextTasks, { config });
    setTasks(reflowed);
    saveCachedTasks(reflowed);

    if (change) {
      const pendingChanges = queuePendingChange({
        ...change,
        changedAt: getNow(),
      });
      setPendingCount(pendingChanges.length);
    }

    setStatus({
      tone: "info",
      message,
    });
  }

  function updateTask(
    taskId: string,
    transform: (task: Task) => Task,
    message: string,
  ) {
    const currentTask = tasks.find((item) => item.id === taskId);

    if (!currentTask) {
      return;
    }

    const updatedTask = {
      ...transform(currentTask),
      updatedAt: getNow(),
    };

    const nextTasks = tasks.map((task) => (task.id === taskId ? updatedTask : task));
    commitTaskState(nextTasks, { type: "upsert", task: updatedTask }, message);
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

    commitTaskState(
      [...tasks, task],
      { type: "upsert", task },
      "Task added locally. Sync to push it to the private data repository.",
    );
  }

  function handleEditTask(taskId: string, draft: TaskDraft) {
    updateTask(
      taskId,
      (task) => ({
        ...task,
        ...draft,
      }),
      "Task updated locally from the top-10 list.",
    );
  }

  function handleComplete(taskId: string) {
    const nextTasks = tasks.filter((task) => task.id !== taskId);
    commitTaskState(
      nextTasks,
      { type: "delete", taskId },
      "Task completed and removed from the active queue.",
    );
  }

  function handleSkip(taskId: string) {
    updateTask(
      taskId,
      (task) => ({
        ...task,
        skipped: true,
      }),
      "Task skipped and deprioritized.",
    );
  }

  function handleUnskip(taskId: string) {
    updateTask(
      taskId,
      (task) => ({
        ...task,
        skipped: false,
      }),
      "Skip state removed and priorities reflowed.",
    );
  }

  function reorderVisibleTasks(nextVisible: Task[]) {
    const visibleIds = new Set(visibleTasks.map((task) => task.id));
    const remainder = allRankedTasks.filter((task) => !visibleIds.has(task.id));
    const manuallyOrdered = applyManualOrder([...nextVisible, ...remainder]);

    commitTaskState(
      manuallyOrdered,
      { type: "replaceAll", tasks: manuallyOrdered },
      "Manual priority order updated.",
    );
  }

  function handleMoveTask(fromId: string, toId: string) {
    const nextVisible = [...visibleTasks];
    const fromIndex = nextVisible.findIndex((task) => task.id === fromId);
    const toIndex = nextVisible.findIndex((task) => task.id === toId);

    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
      return;
    }

    const [moved] = nextVisible.splice(fromIndex, 1);
    nextVisible.splice(toIndex, 0, moved);
    reorderVisibleTasks(nextVisible);
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
    const nextTasks = reflowTasks(clearManualOrder(tasks), { config });

    commitTaskState(
      nextTasks,
      { type: "replaceAll", tasks: nextTasks },
      "Manual ordering cleared. Automatic priority rules are active again.",
    );
  }

  async function handleSync(isAutomatic = false) {
    if (!hasRepoSettings(syncSettings)) {
      setStatus({
        tone: "error",
        message: "Set the private data repository owner, name, and branch before syncing.",
      });
      return;
    }

    if (!syncSettings.token) {
      setStatus({
        tone: "error",
        message: "Add a GitHub token before reading or writing the private data repository.",
      });
      return;
    }

    setIsSyncing(true);

    try {
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

      const mergedConfig = remoteConfigFile.content;
      const pendingChanges = loadPendingChanges();
      const mergedTasks = reflowTasks(
        applyPendingChanges(remoteTasksFile.content.tasks ?? [], pendingChanges),
        { config: mergedConfig },
      );

      setConfig(mergedConfig);
      setTasks(mergedTasks);
      saveCachedConfig(mergedConfig);
      saveCachedTasks(mergedTasks);

      if (pendingChanges.length === 0) {
        setStatus({
          tone: "success",
          message: "Private repository state refreshed from GitHub.",
        });
        return;
      }

      await updateRepositoryJsonFile(
        syncSettings,
        syncSettings.tasksPath,
        { tasks: mergedTasks },
        remoteTasksFile.sha,
        syncSettings.token,
        "Sync tasks from PWA",
      );

      clearPendingChanges();
      setPendingCount(0);
      setStatus({
        tone: "success",
        message: isAutomatic
          ? "Cached changes were synced to the private repository."
          : "Private GitHub repository updated successfully.",
      });
    } catch (error) {
      const message = getErrorMessage(error);
      setStatus({
        tone: "error",
        message: message.includes("409")
          ? "GitHub rejected the update because the file changed remotely. Sync again after reviewing the repo state."
          : message,
      });
    } finally {
      setIsSyncing(false);
    }
  }

  const stats = {
    total: tasks.length,
    visible: visibleTasks.length,
    pending: pendingCount,
    skipped: tasks.filter((task) => task.skipped).length,
  };

  return (
    <main className="app-shell">
      <header className="hero">
        <div className="hero-grid">
          <div>
            <h1>Top 10 Tasks</h1>
            <p>
              A GitHub-native PWA for keeping the next best ten tasks visible,
              reorderable, editable, offline-ready, and deployable with GitHub Pages
              plus GitHub Actions only.
            </p>
          </div>

          <div className="panel" style={{ margin: 0 }}>
            <div className="label-row">
              <h2 style={{ margin: 0 }}>Private data sync</h2>
              <span className="small muted">{getIsOnline() ? "Online" : "Offline"}</span>
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
              <button className="button" type="button" disabled={isSyncing} onClick={() => void handleSync(false)}>
                {isSyncing ? "Syncing..." : "Sync now"}
              </button>
              <span className="small muted">
                Reads and writes <code>{syncSettings.tasksPath}</code> in the private
                <code> {syncSettings.repo}</code> repository.
              </span>
            </div>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat">
            <strong>{stats.total}</strong>
            <span>Total active tasks</span>
          </div>
          <div className="stat">
            <strong>{stats.visible}</strong>
            <span>Visible tasks</span>
          </div>
          <div className="stat">
            <strong>{stats.pending}</strong>
            <span>Pending sync changes</span>
          </div>
          <div className="stat">
            <strong>{stats.skipped}</strong>
            <span>Skipped tasks</span>
          </div>
        </div>

        <div className={`status-banner ${status.tone}`} style={{ marginTop: "1rem" }}>
          {status.message}
        </div>
      </header>

      <section className="section-stack">
        <Filters
          filters={filters}
          moods={config.moods}
          hasManualOrder={hasManualOrder}
          onChange={setFilters}
          onReset={() => setFilters(defaultFilters)}
          onClearManualOrder={handleClearManualOrder}
        />

        <AddTaskForm moods={config.moods} onAddTask={handleAddTask} />

        <TaskList
          tasks={visibleTasks}
          maxVisible={config.maxVisible}
          moods={config.moods}
          onComplete={handleComplete}
          onSkip={handleSkip}
          onUnskip={handleUnskip}
          onMoveTask={handleMoveTask}
          onMoveDirection={handleMoveDirection}
          onSaveEdit={handleEditTask}
        />
      </section>

      <p className="footer-note">
        Static hosting, offline behavior, and background automation are all kept
        inside the repository.
      </p>
    </main>
  );
}
