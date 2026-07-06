import type { AppConfig, Task, TaskFilters } from "../types";

export function hasManualOrder(task: Pick<Task, "manualOrder">): boolean {
  return Number.isInteger(task.manualOrder) && (task.manualOrder ?? -1) >= 0;
}

export function normalizeTask(task: Partial<Task> & Pick<Task, "id" | "title" | "context" | "importance" | "createdAt">): Task {
  const manualOrder =
    task.manualOrder !== undefined && task.manualOrder !== null
      ? task.manualOrder
      : null;
  const legacyMood = (task as Partial<Task> & { mood?: string[] }).mood;

  return {
    ...task,
    notes: task.notes ?? null,
    category:
      task.category ?? (Array.isArray(legacyMood) && legacyMood.length > 0 ? legacyMood[0] : null),
    skipped: Boolean(task.skipped),
    completed: Boolean(task.completed),
    bigWin: Boolean(task.bigWin),
    dueDate: task.dueDate ?? null,
    changedAt: task.changedAt ?? task.updatedAt ?? task.createdAt,
    manualOrder,
  } as Task;
}

export function matchesFilters(task: Task, filters: TaskFilters): boolean {
  if (filters.context !== "all" && task.context !== filters.context) {
    return false;
  }

  if (filters.importance !== "all" && task.importance !== Number(filters.importance)) {
    return false;
  }

  if (filters.category !== "all" && task.category !== filters.category) {
    return false;
  }

  return true;
}

export function scoreTask(task: Task, filters: TaskFilters): number {
  let score = task.importance * 100;

  if (filters.context !== "all" && task.context === filters.context) {
    score += 40;
  }

  if (filters.category !== "all" && task.category === filters.category) {
    score += 24;
  }

  if (task.bigWin) {
    score += 26;
  }

  if (task.skipped) {
    score -= 90;
  }

  return score;
}

export function sortTasks(
  tasks: Task[],
  filters: TaskFilters,
  _config: AppConfig,
): Task[] {
  return tasks
    .map(normalizeTask)
    .filter((task) => matchesFilters(task, filters))
    .sort((left, right) => {
      const leftManual = hasManualOrder(left);
      const rightManual = hasManualOrder(right);

      if (leftManual || rightManual) {
        if (leftManual && rightManual && left.manualOrder !== right.manualOrder) {
          return (left.manualOrder ?? 0) - (right.manualOrder ?? 0);
        }

        if (leftManual !== rightManual) {
          return leftManual ? -1 : 1;
        }
      }

      if (filters.sortMode === "createdAt" && left.createdAt !== right.createdAt) {
        return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      }

      if (filters.sortMode === "dueDate") {
        const leftDue = left.dueDate ? new Date(left.dueDate).getTime() : Number.POSITIVE_INFINITY;
        const rightDue = right.dueDate ? new Date(right.dueDate).getTime() : Number.POSITIVE_INFINITY;

        if (leftDue !== rightDue) {
          return leftDue - rightDue;
        }
      }

      const scoreDifference = scoreTask(right, filters) - scoreTask(left, filters);
      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      if (right.importance !== left.importance) {
        return right.importance - left.importance;
      }

      if (left.createdAt !== right.createdAt) {
        return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      }

      return left.title.localeCompare(right.title);
    });
}
