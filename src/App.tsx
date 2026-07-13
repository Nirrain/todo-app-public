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
  contexts: null,
  categories: null,
  query: "",
  showCompleted: false,
  sortMode: "importance",
};

const defaultConfig: AppConfig = {
  categories: ["practical", "creative", "low-effort"],
  maxVisible: 10,
};

type SettingsView = "login" | "categories" | null;

interface RemoteState {
  config: AppConfig;
  tasks: Task[];
  tasksSha: string;
  configSha: string;
}

interface MutationResult {
  tasks: Task[];
  config: AppConfig;
  writeTasks: boolean;
  writeConfig: boolean;
}

function getNow(): string {
  return new Date().toISOString();
}

function getIsOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function normalizeConfig(config: Partial<AppConfig> & { moods?: string[] }): AppConfig {
  return {
    categories: Array.isArray(config.categories)
      ? config.categories
      : Array.isArray(config.moods)
        ? config.moods
        : defaultConfig.categories,
    maxVisible:
      typeof config.maxVisible === "number" ? config.maxVisible : defaultConfig.maxVisible,
  };
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
  const [visibleCount, setVisibleCount] = useState(defaultConfig.maxVisible);
  const [status, setStatus] = useState<StatusMessage>({
    tone: "info",
    message: "Loading Top 10 Tasks.",
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSettings, setSyncSettings] = useState<SyncSettings>(buildInitialSyncSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsView, setSettingsView] = useState<SettingsView>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  const syncInFlightRef = useRef(false);

  const rankedTasks = useMemo(
    () => sortTasks(tasks, filters, config),
    [config, filters, tasks],
  );
  const visibleTasks = useMemo(
    () => rankedTasks.slice(0, visibleCount),
    [rankedTasks, visibleCount],
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
    setFilters((current) => {
      if (current.categories === null) {
        return current;
      }

      const nextCategories = current.categories.filter((category) =>
        config.categories.includes(category),
      );

      if (nextCategories.length === current.categories.length) {
        return current;
      }

      return {
        ...current,
        categories:
          nextCategories.length === config.categories.length ? null : nextCategories,
      };
    });
  }, [config.categories]);

  useEffect(() => {
    setVisibleCount(config.maxVisible);
  }, [config.maxVisible, filters, tasks]);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        const [staticConfigFile, staticTasks] = await Promise.all([
          fetchStaticJson<Partial<AppConfig> & { moods?: string[] }>("data/config.json"),
          fetchStaticJson<TasksFile>("data/tasks.json"),
        ]);

        if (cancelled) {
          return;
        }

        const staticConfig = normalizeConfig(staticConfigFile);
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
            ? "Open Login in Settings and add a GitHub token to work against the private repository."
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

  async function fetchRemoteState(): Promise<RemoteState> {
    const [remoteTasksFile, remoteConfigFile] = await Promise.all([
      fetchRepositoryJsonFile<TasksFile>(
        syncSettings,
        syncSettings.tasksPath,
        syncSettings.token,
      ),
      fetchRepositoryJsonFile<Partial<AppConfig> & { moods?: string[] }>(
        syncSettings,
        syncSettings.configPath,
        syncSettings.token,
      ),
    ]);

    const remoteConfig = normalizeConfig(remoteConfigFile.content);
    const remoteTasks = reflowTasks(remoteTasksFile.content.tasks ?? [], {
      config: remoteConfig,
    });

    return {
      config: remoteConfig,
      tasks: remoteTasks,
      tasksSha: remoteTasksFile.sha,
      configSha: remoteConfigFile.sha,
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
      setStatus({
        tone: showSuccessMessage ? "success" : "info",
        message: showSuccessMessage
          ? "Private repository refreshed."
          : "Showing live data from the private repository.",
      });
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

  async function runRemoteMutation(
    buildMutation: (remoteTasks: Task[], remoteConfig: AppConfig) => MutationResult,
    successMessage: string,
  ) {
    if (syncInFlightRef.current) {
      return;
    }

    if (!hasRepoSettings(syncSettings)) {
      setStatus({
        tone: "error",
        message: "Open Login in Settings and set the private data repository owner, name, and branch.",
      });
      return;
    }

    if (!syncSettings.token) {
      setStatus({
        tone: "error",
        message: "Open Login in Settings and add a GitHub token before making changes.",
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
          const mutation = buildMutation(remoteState.tasks, remoteState.config);
          const nextConfig = normalizeConfig(mutation.config);
          const nextTasks = reflowTasks(mutation.tasks, { config: nextConfig });

          if (mutation.writeTasks) {
            await updateRepositoryJsonFile(
              syncSettings,
              syncSettings.tasksPath,
              { tasks: nextTasks },
              remoteState.tasksSha,
              syncSettings.token,
              "Sync tasks from PWA",
            );
          }

          if (mutation.writeConfig) {
            await updateRepositoryJsonFile(
              syncSettings,
              syncSettings.configPath,
              nextConfig,
              remoteState.configSha,
              syncSettings.token,
              "Update config from PWA",
            );
          }

          setConfig(nextConfig);
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
          // Preserve the original conflict error if refresh fails too.
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
      completed: false,
      createdAt: now,
      changedAt: now,
      updatedAt: now,
      manualOrder: null,
    };

    void runRemoteMutation(
      (remoteTasks, remoteConfig) => ({
        tasks: [...remoteTasks, task],
        config: remoteConfig,
        writeTasks: true,
        writeConfig: false,
      }),
      "Task saved to the private repository.",
    );
  }

  function handleEditTask(taskId: string, draft: TaskDraft) {
    void runRemoteMutation(
      (remoteTasks, remoteConfig) => ({
        tasks: remoteTasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                ...draft,
                changedAt: getNow(),
                updatedAt: getNow(),
              }
            : task,
        ),
        config: remoteConfig,
        writeTasks: true,
        writeConfig: false,
      }),
      "Task changes saved to the private repository.",
    );
  }

  function handleComplete(taskId: string) {
    void runRemoteMutation(
      (remoteTasks, remoteConfig) => ({
        tasks: remoteTasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                completed: !task.completed,
                changedAt: getNow(),
                updatedAt: getNow(),
              }
            : task,
        ),
        config: remoteConfig,
        writeTasks: true,
        writeConfig: false,
      }),
      "Task completion saved.",
    );
  }

  function handleSkip(taskId: string) {
    void runRemoteMutation(
      (remoteTasks, remoteConfig) => ({
        tasks: remoteTasks.map((task) =>
          task.id === taskId
            ? { ...task, skipped: true, changedAt: getNow(), updatedAt: getNow() }
            : task,
        ),
        config: remoteConfig,
        writeTasks: true,
        writeConfig: false,
      }),
      "Task skipped and saved.",
    );
  }

  function handleUnskip(taskId: string) {
    void runRemoteMutation(
      (remoteTasks, remoteConfig) => ({
        tasks: remoteTasks.map((task) =>
          task.id === taskId
            ? { ...task, skipped: false, changedAt: getNow(), updatedAt: getNow() }
            : task,
        ),
        config: remoteConfig,
        writeTasks: true,
        writeConfig: false,
      }),
      "Skip reset and saved.",
    );
  }

  function handleMoveTask(fromId: string, toId: string) {
    void runRemoteMutation((remoteTasks, remoteConfig) => {
      const remoteVisible = sortTasks(remoteTasks, filters, remoteConfig).slice(
        0,
        remoteConfig.maxVisible,
      );
      const remoteVisibleIds = new Set(remoteVisible.map((task) => task.id));
      const fromIndex = remoteVisible.findIndex((task) => task.id === fromId);
      const toIndex = remoteVisible.findIndex((task) => task.id === toId);

      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
        return {
          tasks: remoteTasks,
          config: remoteConfig,
          writeTasks: false,
          writeConfig: false,
        };
      }

      const nextVisible = [...remoteVisible];
      const [moved] = nextVisible.splice(fromIndex, 1);
      nextVisible.splice(toIndex, 0, moved);

      const remainder = sortTasks(remoteTasks, defaultFilters, remoteConfig).filter(
        (task) => !remoteVisibleIds.has(task.id),
      );

      return {
        tasks: applyManualOrder([...nextVisible, ...remainder]),
        config: remoteConfig,
        writeTasks: true,
        writeConfig: false,
      };
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
    void runRemoteMutation(
      (remoteTasks, remoteConfig) => ({
        tasks: reflowTasks(clearManualOrder(remoteTasks), { config: remoteConfig }),
        config: remoteConfig,
        writeTasks: true,
        writeConfig: false,
      }),
      "Automatic ordering restored.",
    );
  }

  function handleAddCategory() {
    const trimmed = newCategory.trim();

    if (!trimmed) {
      return;
    }

    void runRemoteMutation(
      (remoteTasks, remoteConfig) => {
        if (remoteConfig.categories.includes(trimmed)) {
          return {
            tasks: remoteTasks,
            config: remoteConfig,
            writeTasks: false,
            writeConfig: false,
          };
        }

        return {
          tasks: remoteTasks,
          config: {
            ...remoteConfig,
            categories: [...remoteConfig.categories, trimmed],
          },
          writeTasks: false,
          writeConfig: true,
        };
      },
      "Category list saved.",
    );

    setNewCategory("");
  }

  function handleDeleteCategory(category: string) {
    void runRemoteMutation(
      (remoteTasks, remoteConfig) => ({
        tasks: remoteTasks.map((task) =>
          task.category === category
            ? { ...task, category: null, changedAt: getNow(), updatedAt: getNow() }
            : task,
        ),
        config: {
          ...remoteConfig,
          categories: remoteConfig.categories.filter((item) => item !== category),
        },
        writeTasks: true,
        writeConfig: true,
      }),
      "Category removed and affected tasks cleared.",
    );
  }

  function closeSettingsPanel() {
    setIsSettingsOpen(false);
    setSettingsView(null);
  }

  function toggleSettingsPanel() {
    if (isSettingsOpen) {
      closeSettingsPanel();
      return;
    }

    setIsSettingsOpen(true);
    setSettingsView(null);
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
            onClick={toggleSettingsPanel}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>

      <div className={`status-banner ${status.tone} compact-status`}>{status.message}</div>

      <section className="utility-strip utility-strip-top">
        <button
          className="button secondary compact-button"
          type="button"
          onClick={() => setIsFiltersOpen((current) => !current)}
        >
          {isFiltersOpen ? "Hide filters" : "Filters"}
        </button>
        <button
          className="button secondary compact-button"
          type="button"
          onClick={() => setIsComposerOpen((current) => !current)}
        >
          {isComposerOpen ? "Hide new task" : "New task"}
        </button>
      </section>

      {isSettingsOpen ? (
        <section className="panel settings-panel" aria-labelledby="settings-heading">
          <div className="label-row">
            <h2 id="settings-heading">Settings</h2>
            <button
              className="button ghost compact-button"
              type="button"
              onClick={closeSettingsPanel}
            >
              Close
            </button>
          </div>

          <div className="submenu-strip">
            <button
              className={`button compact-button ${settingsView === "login" ? "" : "secondary"}`}
              type="button"
              onClick={() => setSettingsView("login")}
            >
              Login
            </button>
            <button
              className={`button compact-button ${settingsView === "categories" ? "" : "secondary"}`}
              type="button"
              onClick={() => setSettingsView("categories")}
            >
              Categories
            </button>
          </div>

          {settingsView === "login" ? (
            <>
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
            </>
          ) : settingsView === "categories" ? (
            <div className="section-stack">
              <div className="field-group">
                <span>New category</span>
                <div className="inline-form">
                  <input
                    type="text"
                    value={newCategory}
                    disabled={!canMutate}
                    placeholder="Add a category"
                    onChange={(event) => setNewCategory(event.target.value)}
                  />
                  <button
                    className="button compact-button"
                    type="button"
                    disabled={!canMutate || !newCategory.trim()}
                    onClick={handleAddCategory}
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="category-list">
                {config.categories.map((category) => (
                  <div key={category} className="category-row">
                    <span className="chip subtle">{category}</span>
                    <button
                      className="button ghost compact-button"
                      type="button"
                      disabled={!canMutate}
                      onClick={() => handleDeleteCategory(category)}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="small muted settings-empty">Choose a settings section.</p>
          )}
        </section>
      ) : null}

      {isFiltersOpen ? (
        <Filters
          filters={filters}
          categories={config.categories}
          hasManualOrder={hasManualOrder}
          disabled={isSyncing}
          onChange={setFilters}
          onReset={() => setFilters(defaultFilters)}
          onClearManualOrder={handleClearManualOrder}
        />
      ) : null}

      {isComposerOpen ? (
        <AddTaskForm
          categories={config.categories}
          disabled={!canMutate}
          onAddTask={handleAddTask}
        />
      ) : null}

      <TaskList
        tasks={visibleTasks}
        maxVisible={config.maxVisible}
        totalCount={rankedTasks.length}
        categories={config.categories}
        disabled={!canMutate}
        canLoadMore={visibleTasks.length < rankedTasks.length}
        onLoadMore={() =>
          setVisibleCount((current) => current + config.maxVisible)
        }
        onComplete={handleComplete}
        onSkip={handleSkip}
        onUnskip={handleUnskip}
        onMoveTask={handleMoveTask}
        onMoveDirection={handleMoveDirection}
        onSaveEdit={handleEditTask}
      />
    </main>
  );
}
