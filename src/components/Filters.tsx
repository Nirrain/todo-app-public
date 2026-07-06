import type { TaskFilters } from "../types";

interface FiltersProps {
  filters: TaskFilters;
  moods: string[];
  hasManualOrder: boolean;
  onChange: (filters: TaskFilters) => void;
  onReset: () => void;
  onClearManualOrder: () => void;
}

export default function Filters({
  filters,
  moods,
  hasManualOrder,
  onChange,
  onReset,
  onClearManualOrder,
}: FiltersProps) {
  function toggleMood(mood: string) {
    const nextMoods = filters.moods.includes(mood)
      ? filters.moods.filter((item) => item !== mood)
      : [...filters.moods, mood];

    onChange({
      ...filters,
      moods: nextMoods,
    });
  }

  return (
    <section className="panel" aria-labelledby="filters-heading">
      <div className="label-row">
        <h2 id="filters-heading">Filters and ordering</h2>
        <span className="small muted">Top 10 only</span>
      </div>

      <div className="control-grid">
        <label className="field-group">
          <span>Context</span>
          <select
            value={filters.context}
            onChange={(event) =>
              onChange({ ...filters, context: event.target.value as TaskFilters["context"] })
            }
          >
            <option value="all">All contexts</option>
            <option value="indoor">Indoor</option>
            <option value="outdoor">Outdoor</option>
          </select>
        </label>

        <label className="field-group">
          <span>Importance</span>
          <select
            value={filters.importance}
            onChange={(event) =>
              onChange({
                ...filters,
                importance: event.target.value as TaskFilters["importance"],
              })
            }
          >
            <option value="all">All levels</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
        </label>
      </div>

      <div className="field-group">
        <span>Mood</span>
        <div className="chip-row">
          {moods.map((mood) => (
            <button
              key={mood}
              type="button"
              className={`chip ${filters.moods.includes(mood) ? "active" : ""}`}
              onClick={() => toggleMood(mood)}
            >
              {mood}
            </button>
          ))}
        </div>
      </div>

      <div className="action-row">
        <button className="button secondary" type="button" onClick={onReset}>
          Reset filters
        </button>
        <button
          className="button ghost"
          type="button"
          disabled={!hasManualOrder}
          onClick={onClearManualOrder}
        >
          Clear manual order
        </button>
      </div>
    </section>
  );
}

