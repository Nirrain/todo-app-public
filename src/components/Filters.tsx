import { useMemo, useState } from "react";
import type { TaskContext, TaskFilters } from "../types";

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
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const contextOptions = useMemo(
    () =>
      [
        { value: "indoor", label: "Indoor" },
        { value: "outdoor", label: "Outdoor" },
      ] as const,
    [],
  );
  const sortOptions = useMemo(
    () =>
      [
        { value: "importance", label: "Importance" },
        { value: "createdAt", label: "Created date" },
        { value: "dueDate", label: "Due date" },
      ] as const,
    [],
  );

  function isSelected(values: string[] | null, value: string) {
    return values === null || values.includes(value);
  }

  function toggleValue(
    currentValues: string[] | null,
    value: string,
    allValues: readonly string[],
  ) {
    const activeValues = currentValues ?? [...allValues];
    const nextValues = activeValues.includes(value)
      ? activeValues.filter((item) => item !== value)
      : [...activeValues, value];

    if (nextValues.length === allValues.length) {
      return null;
    }

    return nextValues;
  }

  return (
    <section className="panel" aria-labelledby="filters-heading">
      <div className="label-row">
        <h2 id="filters-heading">Filters and ordering</h2>
        <span className="small muted">Top 10 only</span>
      </div>

      <div className="filter-block">
        <span className="filter-label">Context</span>
        <div className="toggle-row">
          {contextOptions.map((option) => (
            <button
              key={option.value}
              className={`chip toggle-chip ${isSelected(filters.contexts, option.value) ? "active" : ""}`}
              type="button"
              disabled={disabled}
              onClick={() =>
                onChange({
                  ...filters,
                  contexts: toggleValue(
                    filters.contexts,
                    option.value,
                    contextOptions.map((item) => item.value) as TaskContext[],
                  ) as TaskContext[] | null,
                })
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-block">
        <span className="filter-label">Category</span>
        {categories.length > 0 ? (
          <div className="toggle-row">
            {categories.map((category) => (
              <button
                key={category}
                className={`chip toggle-chip ${isSelected(filters.categories, category) ? "active" : ""}`}
                type="button"
                disabled={disabled}
                onClick={() =>
                  onChange({
                    ...filters,
                    categories: toggleValue(filters.categories, category, categories),
                  })
                }
              >
                {category}
              </button>
            ))}
          </div>
        ) : (
          <p className="small muted">No categories configured yet.</p>
        )}
      </div>

      <div className="filter-toolbar">
        <div className="sort-control">
          <button
            className="button secondary compact-button sort-button"
            type="button"
            disabled={disabled}
            aria-haspopup="true"
            aria-expanded={isSortMenuOpen}
            aria-label="Change sort order"
            onClick={() => setIsSortMenuOpen((current) => !current)}
          >
            <span className="sort-icon" aria-hidden="true">
              <span className="sort-line short" />
              <span className="sort-line medium" />
              <span className="sort-line long" />
            </span>
            <span>{sortOptions.find((option) => option.value === filters.sortMode)?.label}</span>
          </button>

          {isSortMenuOpen ? (
            <div className="sort-menu" role="menu" aria-label="Sort tasks">
              {sortOptions.map((option) => (
                <button
                  key={option.value}
                  className={`button compact-button ${filters.sortMode === option.value ? "" : "secondary"}`}
                  type="button"
                  role="menuitemradio"
                  aria-checked={filters.sortMode === option.value}
                  onClick={() => {
                    onChange({
                      ...filters,
                      sortMode: option.value as TaskFilters["sortMode"],
                    });
                    setIsSortMenuOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <label className="field-group search-field">
          <span>Search</span>
          <input
            type="text"
            value={filters.query}
            disabled={disabled}
            placeholder="Filter tasks"
            onChange={(event) =>
              onChange({
                ...filters,
                query: event.target.value,
              })
            }
          />
        </label>
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
