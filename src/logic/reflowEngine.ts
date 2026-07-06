import type { AppConfig, Task, TaskFilters } from "../types";
import { hasManualOrder, normalizeTask, sortTasks } from "./priorityEngine";

interface ReflowOptions {
  filters?: TaskFilters;
  config: AppConfig;
}

export function applyManualOrder(tasksInOrder: Task[]): Task[] {
  return tasksInOrder.map((task, index) => ({
    ...normalizeTask(task),
    manualOrder: index,
    updatedAt: task.updatedAt ?? new Date().toISOString(),
  }));
}

export function clearManualOrder(tasks: Task[]): Task[] {
  return tasks.map((task) => ({
    ...normalizeTask(task),
    manualOrder: null,
    updatedAt: new Date().toISOString(),
  }));
}

export function reflowTasks(tasks: Task[], options: ReflowOptions): Task[] {
  const filters =
    options.filters ?? {
      context: "all",
      importance: "all",
      category: "all",
      sortMode: "importance",
    };
  const ordered = sortTasks(tasks, filters, options.config).map(normalizeTask);
  const manualTasks = ordered.filter(hasManualOrder);

  if (manualTasks.length === 0) {
    return ordered.map((task) => ({
      ...task,
      manualOrder: null,
    }));
  }

  const manualIndexById = new Map(
    manualTasks.map((task, index) => [task.id, index] as const),
  );

  return ordered.map((task) => ({
    ...task,
    manualOrder: manualIndexById.get(task.id) ?? null,
  }));
}
