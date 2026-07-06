import type { TaskFilters } from "../types";

interface FiltersProps {
  filters: TaskFilters;
  categories: string[];
  hasManualOrder: boolean;
  disabled: boolean;
  onChange: (filters: TaskFilters) => void;
  onReset: () => void;
  onClearManualOrder: () => void;
}

export default function Filters({
  filters,
  categories,
  hasManualOrder,
  disabled,
  onChange,
  onReset,
  onClearManualOrder,
}: FiltersProps) {
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
            disabled={disabled}
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
            disabled={disabled}
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

      <label className="field-group">
        <span>Sort by</span>
        <select
          value={filters.sortMode}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...filters,
              sortMode: event.target.value as TaskFilters["sortMode"],
            })
          }
        >
          <option value="importance">Importance</option>
          <option value="createdAt">Created date</option>
          <option value="dueDate">Due date ascending</option>
        </select>
      </label>

      <div className="field-group">
        <span>Category</span>
        <select
          value={filters.category}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...filters,
              category: event.target.value,
            })
          }
        >
          <option value="all">All categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      <div className="action-row">
        <button className="button secondary compact-button" type="button" disabled={disabled} onClick={onReset}>
          Reset filters
        </button>
        <button
          className="button ghost compact-button"
          type="button"
          disabled={!hasManualOrder || disabled}
          onClick={onClearManualOrder}
        >
          Clear manual order
        </button>
      </div>
    </section>
  );
}
