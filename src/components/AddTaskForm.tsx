import { useMemo, useState, type FormEvent } from "react";
import type { TaskContext, TaskDraft } from "../types";

interface AddTaskFormProps {
  categories: string[];
  disabled: boolean;
  onAddTask: (draft: TaskDraft) => void;
}

interface DraftState {
  title: string;
  notes: string;
  context: TaskContext;
  importance: 1 | 2 | 3;
  category: string;
  dueDate: string;
}

const defaultTask: DraftState = {
  title: "",
  notes: "",
  context: "indoor",
  importance: 2,
  category: "",
  dueDate: "",
};

export default function AddTaskForm({ categories, disabled, onAddTask }: AddTaskFormProps) {
  const [draft, setDraft] = useState<DraftState>(defaultTask);
  const canSubmit = useMemo(() => draft.title.trim().length > 0, [draft.title]);

  function updateField<K extends keyof DraftState>(field: K, value: DraftState[K]) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    onAddTask({
      title: draft.title.trim(),
      notes: draft.notes.trim() || null,
      context: draft.context,
      importance: draft.importance,
      category: draft.category || null,
      dueDate: draft.dueDate || null,
    });

    setDraft(defaultTask);
  }

  return (
    <section className="panel" aria-labelledby="add-task-heading">
      <h2 id="add-task-heading">Add a task</h2>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label className="field-group">
          <span>One-sentence task</span>
          <input
            type="text"
            value={draft.title}
            maxLength={120}
            disabled={disabled}
            placeholder="Write the next useful task"
            onChange={(event) => updateField("title", event.target.value)}
          />
        </label>

        <label className="field-group">
          <span>Optional notes</span>
          <textarea
            value={draft.notes}
            disabled={disabled}
            placeholder="Anything worth remembering"
            onChange={(event) => updateField("notes", event.target.value)}
          />
        </label>

        <div className="control-grid">
          <label className="field-group">
            <span>Context</span>
            <select
              value={draft.context}
              disabled={disabled}
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
              disabled={disabled}
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

        <label className="field-group">
          <span>Due date</span>
          <input
            type="date"
            value={draft.dueDate}
            disabled={disabled}
            onChange={(event) => updateField("dueDate", event.target.value)}
          />
        </label>

        <div className="field-group">
          <span>Category</span>
          <select
            value={draft.category}
            disabled={disabled}
            onChange={(event) => updateField("category", event.target.value)}
          >
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <button className="button compact-button" type="submit" disabled={!canSubmit || disabled}>
          Add task
        </button>
      </form>
    </section>
  );
}
