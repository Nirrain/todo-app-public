import { useEffect, useMemo, useState } from "react";
import type { Task, TaskContext, TaskDraft } from "../types";

interface TaskItemProps {
  task: Task;
  index: number;
  isDragging: boolean;
  moods: string[];
  onComplete: () => void;
  onSkip: () => void;
  onUnskip: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onSaveEdit: (draft: TaskDraft) => void;
}

interface EditState {
  title: string;
  notes: string;
  context: TaskContext;
  importance: 1 | 2 | 3;
  mood: string[];
  bigWin: boolean;
}

function toEditState(task: Task): EditState {
  return {
    title: task.title,
    notes: task.notes ?? "",
    context: task.context,
    importance: task.importance,
    mood: [...task.mood],
    bigWin: task.bigWin,
  };
}

export default function TaskItem({
  task,
  index,
  isDragging,
  moods,
  onComplete,
  onSkip,
  onUnskip,
  onMoveUp,
  onMoveDown,
  onSaveEdit,
}: TaskItemProps) {
  const [showNotes, setShowNotes] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<EditState>(() => toEditState(task));
  const canSave = useMemo(() => draft.title.trim().length > 0, [draft.title]);

  useEffect(() => {
    setDraft(toEditState(task));
  }, [task]);

  function updateField<K extends keyof EditState>(field: K, value: EditState[K]) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function toggleMood(mood: string) {
    setDraft((current) => ({
      ...current,
      mood: current.mood.includes(mood)
        ? current.mood.filter((item) => item !== mood)
        : [...current.mood, mood],
    }));
  }

  function handleSave() {
    if (!canSave) {
      return;
    }

    onSaveEdit({
      title: draft.title.trim(),
      notes: draft.notes.trim() || null,
      context: draft.context,
      importance: draft.importance,
      mood: draft.mood,
      bigWin: draft.bigWin,
    });
    setIsEditing(false);
  }

  function handleCancel() {
    setDraft(toEditState(task));
    setIsEditing(false);
  }

  return (
    <article className={`task-card ${isDragging ? "dragging" : ""}`}>
      <div className="task-header">
        <span className="task-rank" aria-label={`Priority ${index + 1}`}>
          {index + 1}
        </span>
        <div>
          <h3 className="task-title">{task.title}</h3>
          <div className="task-meta">
            <span className="pill accent">{task.context}</span>
            <span className="pill">importance {task.importance}</span>
            {task.bigWin ? <span className="pill accent">big win</span> : null}
            {task.skipped ? <span className="pill warning">skipped</span> : null}
            {task.manualOrder !== null ? <span className="pill">manual</span> : null}
          </div>
        </div>
      </div>

      {!isEditing ? (
        <>
          <div className="chip-row" style={{ marginTop: "0.75rem" }}>
            {task.mood.map((mood) => (
              <span key={mood} className="chip subtle">
                {mood}
              </span>
            ))}
          </div>

          {task.notes ? (
            <>
              <button
                className="button ghost"
                type="button"
                style={{ marginTop: "0.8rem" }}
                onClick={() => setShowNotes((current) => !current)}
              >
                {showNotes ? "Hide notes" : "Show notes"}
              </button>
              {showNotes ? <div className="notes">{task.notes}</div> : null}
            </>
          ) : null}
        </>
      ) : (
        <div className="edit-panel">
          <label className="field-group">
            <span>Task title</span>
            <input
              type="text"
              value={draft.title}
              maxLength={120}
              onChange={(event) => updateField("title", event.target.value)}
            />
          </label>

          <label className="field-group">
            <span>Notes</span>
            <textarea
              value={draft.notes}
              onChange={(event) => updateField("notes", event.target.value)}
            />
          </label>

          <div className="control-grid">
            <label className="field-group">
              <span>Context</span>
              <select
                value={draft.context}
                onChange={(event) =>
                  updateField("context", event.target.value as TaskContext)
                }
              >
                <option value="indoor">Indoor</option>
                <option value="outdoor">Outdoor</option>
              </select>
            </label>

            <label className="field-group">
              <span>Importance</span>
              <select
                value={draft.importance}
                onChange={(event) =>
                  updateField("importance", Number(event.target.value) as 1 | 2 | 3)
                }
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </label>
          </div>

          <div className="field-group">
            <span>Mood tags</span>
            <div className="chip-row">
              {moods.map((mood) => (
                <button
                  key={mood}
                  type="button"
                  className={`chip ${draft.mood.includes(mood) ? "active" : ""}`}
                  onClick={() => toggleMood(mood)}
                >
                  {mood}
                </button>
              ))}
            </div>
          </div>

          <label className="chip-row">
            <input
              type="checkbox"
              checked={draft.bigWin}
              onChange={(event) => updateField("bigWin", event.target.checked)}
            />
            <span>Big win</span>
          </label>

          <div className="action-row">
            <button className="button" type="button" disabled={!canSave} onClick={handleSave}>
              Save
            </button>
            <button className="button secondary" type="button" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="task-actions">
        <button className="button secondary" type="button" onClick={onMoveUp}>
          Move up
        </button>
        <button className="button secondary" type="button" onClick={onMoveDown}>
          Move down
        </button>
        <button className="button ghost" type="button" onClick={() => setIsEditing((current) => !current)}>
          {isEditing ? "Close edit" : "Edit"}
        </button>
        <button className="button" type="button" onClick={onComplete}>
          Complete
        </button>
        {task.skipped ? (
          <button className="button ghost" type="button" onClick={onUnskip}>
            Reset skip
          </button>
        ) : (
          <button className="button ghost" type="button" onClick={onSkip}>
            Skip
          </button>
        )}
      </div>
    </article>
  );
}

