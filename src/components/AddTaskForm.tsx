import { useMemo, useState, type FormEvent } from "react";
import type { TaskContext, TaskDraft } from "../types";

interface AddTaskFormProps {
  moods: string[];
  onAddTask: (draft: TaskDraft) => void;
}

interface DraftState {
  title: string;
  notes: string;
  context: TaskContext;
  importance: 1 | 2 | 3;
  moods: string[];
  bigWin: boolean;
}

const defaultTask: DraftState = {
  title: "",
  notes: "",
  context: "indoor",
  importance: 2,
  moods: [],
  bigWin: false,
};

export default function AddTaskForm({ moods, onAddTask }: AddTaskFormProps) {
  const [draft, setDraft] = useState<DraftState>(defaultTask);
  const canSubmit = useMemo(() => draft.title.trim().length > 0, [draft.title]);

  function updateField<K extends keyof DraftState>(field: K, value: DraftState[K]) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function toggleMood(mood: string) {
    setDraft((current) => ({
      ...current,
      moods: current.moods.includes(mood)
        ? current.moods.filter((item) => item !== mood)
        : [...current.moods, mood],
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
      mood: draft.moods,
      bigWin: draft.bigWin,
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
            placeholder="Write the next useful task"
            onChange={(event) => updateField("title", event.target.value)}
          />
        </label>

        <label className="field-group">
          <span>Optional notes</span>
          <textarea
            value={draft.notes}
            placeholder="Anything worth remembering"
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
                className={`chip ${draft.moods.includes(mood) ? "active" : ""}`}
                type="button"
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
          <span>Mark as a big win</span>
        </label>

        <button className="button" type="submit" disabled={!canSubmit}>
          Add task
        </button>
      </form>
    </section>
  );
}
