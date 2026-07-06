import type { AppConfig, Task, TaskFilters } from "../types";

export function hasManualOrder(task: Pick<Task, "manualOrder">): boolean {
  return Number.isInteger(task.manualOrder) && (task.manualOrder ?? -1) >= 0;
}

export function normalizeTask(task: Partial<Task> & Pick<Task, "id" | "title" | "context" | "importance" | "createdAt">): Task {
  const manualOrder =
    task.manualOrder !== undefined && task.manualOrder !== null
      ? task.manualOrder
      : null;

  return {
    ...task,
    notes: task.notes ?? null,
    mood: Array.isArray(task.mood) ? task.mood : [],
    skipped: Boolean(task.skipped),
    bigWin: Boolean(task.bigWin),
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

  if (filters.moods.length > 0) {
    const moodSet = new Set(task.mood);
    return filters.moods.every((mood) => moodSet.has(mood));
  }

  return true;
}

export function scoreTask(task: Task, filters: TaskFilters): number {
  let score = task.importance * 100;

  if (filters.context !== "all" && task.context === filters.context) {
    score += 40;
  }

  if (filters.moods.length > 0) {
    const moodMatches = filters.moods.filter((mood) => task.mood.includes(mood)).length;
    score += moodMatches * 24;
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
