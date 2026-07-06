import { useState } from "react";
import type { Task, TaskDraft } from "../types";
import TaskItem from "./TaskItem";

interface TaskListProps {
  tasks: Task[];
  maxVisible: number;
  totalCount: number;
  categories: string[];
  disabled: boolean;
  canLoadMore: boolean;
  onLoadMore: () => void;
  onComplete: (taskId: string) => void;
  onSkip: (taskId: string) => void;
  onUnskip: (taskId: string) => void;
  onMoveTask: (fromId: string, toId: string) => void;
  onMoveDirection: (taskId: string, delta: number) => void;
  onSaveEdit: (taskId: string, draft: TaskDraft) => void;
}

export default function TaskList({
  tasks,
  maxVisible,
  totalCount,
  categories,
  disabled,
  canLoadMore,
  onLoadMore,
  onComplete,
  onSkip,
  onUnskip,
  onMoveTask,
  onMoveDirection,
  onSaveEdit,
}: TaskListProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);

  if (tasks.length === 0) {
    return (
      <section className="empty-state">
        <h2>No tasks match the current view</h2>
        <p className="muted">
          Reset filters or add a new task to refill the top-ten queue.
        </p>
      </section>
    );
  }

  return (
    <section className="section-stack" aria-labelledby="task-list-heading">
      <div className="label-row">
        <h2 id="task-list-heading">Top 10</h2>
        <span className="small muted">
          Showing {tasks.length} of {totalCount}
        </span>
      </div>

      <ol className="task-list">
        {tasks.map((task, index) => (
          <li
            key={task.id}
            draggable
            onDragStart={() => setDraggedId(task.id)}
            onDragEnd={() => setDraggedId(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (draggedId && draggedId !== task.id) {
                onMoveTask(draggedId, task.id);
              }
              setDraggedId(null);
            }}
          >
            <TaskItem
              task={task}
              index={index}
              isDragging={draggedId === task.id}
              categories={categories}
              disabled={disabled}
              onComplete={() => onComplete(task.id)}
              onSkip={() => onSkip(task.id)}
              onUnskip={() => onUnskip(task.id)}
              onMoveUp={() => onMoveDirection(task.id, -1)}
              onMoveDown={() => onMoveDirection(task.id, 1)}
              onSaveEdit={(draft) => onSaveEdit(task.id, draft)}
            />
          </li>
        ))}
      </ol>

      {canLoadMore ? (
        <div className="load-more-row">
          <button
            className="button secondary compact-button"
            type="button"
            disabled={disabled}
            onClick={onLoadMore}
          >
            Load more
          </button>
        </div>
      ) : null}
    </section>
  );
}
