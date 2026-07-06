export type TaskContext = "indoor" | "outdoor";

export interface Task {
  id: string;
  title: string;
  notes: string | null;
  context: TaskContext;
  importance: 1 | 2 | 3;
  category: string | null;
  skipped: boolean;
  completed: boolean;
  createdAt: string;
  dueDate?: string | null;
  changedAt?: string;
  updatedAt?: string;
  manualOrder: number | null;
}

export interface TaskDraft {
  title: string;
  notes: string | null;
  context: TaskContext;
  importance: 1 | 2 | 3;
  category: string | null;
  dueDate: string | null;
}

export interface AppConfig {
  categories: string[];
  maxVisible: number;
}

export interface TaskFilters {
  contexts: TaskContext[] | null;
  categories: string[] | null;
  query: string;
  sortMode: "importance" | "createdAt" | "dueDate";
}

export interface SyncSettings {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  tasksPath: string;
  configPath: string;
}

export interface StatusMessage {
  tone: "info" | "success" | "error";
  message: string;
}

export interface RepositoryJsonFile<T> {
  sha: string;
  content: T;
}

export interface TasksFile {
  tasks: Task[];
}
