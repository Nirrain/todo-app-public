export type TaskContext = "indoor" | "outdoor";

export interface Task {
  id: string;
  title: string;
  notes: string | null;
  context: TaskContext;
  importance: 1 | 2 | 3;
  mood: string[];
  bigWin: boolean;
  skipped: boolean;
  createdAt: string;
  updatedAt?: string;
  manualOrder: number | null;
}

export interface TaskDraft {
  title: string;
  notes: string | null;
  context: TaskContext;
  importance: 1 | 2 | 3;
  mood: string[];
  bigWin: boolean;
}

export interface AppConfig {
  moods: string[];
  maxVisible: number;
}

export interface TaskFilters {
  context: TaskContext | "all";
  importance: "all" | "1" | "2" | "3";
  moods: string[];
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

export type PendingChange =
  | { type: "replaceAll"; tasks: Task[]; changedAt?: string }
  | { type: "upsert"; task: Task; changedAt?: string }
  | { type: "delete"; taskId: string; changedAt?: string };

