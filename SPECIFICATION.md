# Todo App Specification

This document is the live definition of the current app behavior as implemented in this repository.

## [SPEC-001] Product definition

The app is a mobile-first React PWA for maintaining a personally prioritized task list. It presents a ranked task queue with an initial visible window of 10 items and supports direct editing, filtering, manual reordering, category management, and GitHub-backed persistence.

## [SPEC-002] Runtime and architecture

The app is a static Vite build with no custom backend. It runs entirely in the browser and uses the GitHub REST API to read and write JSON files in a repository selected in Settings.

### [SPEC-002-A] Bundled fallback data

The published app bundle includes `data/tasks.json` and `data/config.json` as fallback data so the UI can render without a configured token or while offline.

### [SPEC-002-B] Live repository mode

When the browser is online and valid sync settings are present, the app treats the configured repository branch and file paths as the live data source and writes every user mutation back to that repository immediately.

## [SPEC-003] Data model

### [SPEC-003-A] Task record

Each task stores:

| Field | Meaning |
| --- | --- |
| `id` | Stable task identifier |
| `title` | Required short task label |
| `notes` | Optional longer text |
| `context` | Either `indoor` or `outdoor` |
| `importance` | Integer priority level `1` to `3` |
| `category` | Optional single category value |
| `skipped` | Whether the task has been intentionally deprioritized |
| `completed` | Whether the task is marked done |
| `createdAt` | Creation timestamp |
| `dueDate` | Optional date-only deadline |
| `changedAt` | Timestamp of the most recent user-visible task change |
| `updatedAt` | Timestamp used for persisted updates |
| `manualOrder` | Optional explicit order slot overriding automatic ranking |

### [SPEC-003-B] Config record

The app configuration stores:

| Field | Meaning |
| --- | --- |
| `categories` | Allowed category values shown in forms and filters |
| `maxVisible` | Number of tasks shown initially and added per "Load more" action |

### [SPEC-003-C] Sync settings

The browser stores sync settings in local storage. These settings include `token`, `owner`, `repo`, `branch`, `tasksPath`, and `configPath`.

## [SPEC-004] Startup and data loading

On startup, the app loads bundled `config.json` and `tasks.json`, normalizes the data, and shows that state immediately. If sync is possible, it then refreshes from the configured live repository and replaces the fallback state with remote state.

### [SPEC-004-A] Status messaging

The app always shows a status banner describing the current state, including loading, read-only fallback mode, offline mode, refresh success, save success, and error conditions.

### [SPEC-004-B] Online and offline transitions

The app listens for browser online/offline events. Going offline disables mutations. Returning online triggers a refresh when sync is already configured; otherwise it prompts the user to configure login details.

## [SPEC-005] Main screen layout

The main screen contains:

1. A top bar with app title, short sync copy, current connectivity/save chip, and a settings button.
2. A persistent status banner.
3. A utility strip with toggles for the filters panel and new-task composer.
4. A conditionally rendered settings panel.
5. A conditionally rendered filters panel.
6. A conditionally rendered add-task form.
7. The ranked task list.

Both the filters panel and new-task composer are collapsed by default.

## [SPEC-006] Task list behavior

### [SPEC-006-A] Ranked list

The task list shows tasks in ranked order and labels the list as "Top 10". The initial visible count equals `config.maxVisible`, but the user can reveal additional pages of the ranked list with "Load more", in increments of the same value.

### [SPEC-006-B] Empty state

If no tasks match the current filters, the app shows an empty state that instructs the user to reset filters or add a new task.

### [SPEC-006-C] Task card display

Each visible task card shows:

- position in the current visible list
- title
- context pill
- importance pill
- optional due-date pill
- optional skipped pill
- optional completed pill
- optional manual-order pill
- optional category chip
- optional notes toggle and notes body

## [SPEC-007] Task creation and editing

### [SPEC-007-A] Add-task form

The add-task form supports:

- required title, trimmed before save
- optional notes
- context selection
- importance selection
- optional due date
- optional category from configured categories

Submitting creates a new task with generated `id`, `createdAt`, `changedAt`, `updatedAt`, `skipped = false`, `completed = false`, and `manualOrder = null`.

### [SPEC-007-B] Inline edit form

Each visible task can be edited inline. Editing supports the same user-facing fields as creation and saves changes back to the live repository.

## [SPEC-008] Task actions

### [SPEC-008-A] Complete toggle

The "Done" action toggles `completed` on and off. Completed tasks remain in the dataset and continue to participate in ranking and filtering.

### [SPEC-008-B] Skip toggle

The "Skip" action sets `skipped = true`. "Undo skip" sets it back to `false`. Skipped tasks stay visible but receive a ranking penalty during automatic sorting.

### [SPEC-008-C] Manual ordering

Visible tasks can be manually reordered by drag-and-drop or with Up/Down controls. Manual ordering is stored in `manualOrder` and takes precedence over automatic ordering until the user clears manual order.

### [SPEC-008-D] Clear manual order

The filters panel includes "Clear manual order". This removes all explicit `manualOrder` values and returns the list to automatic ranking.

## [SPEC-009] Ranking and filtering rules

### [SPEC-009-A] Filter controls

The filters panel supports:

- context toggle chips for `indoor` and `outdoor`
- category toggle chips for configured categories only
- free-text search
- sort-mode selection via a compact menu

### [SPEC-009-B] Search matching

Free-text search is case-insensitive and matches against task title, notes, and category text.

### [SPEC-009-C] Sort modes

The available sort modes are:

| Mode | Rule |
| --- | --- |
| `importance` | Automatic ranking by score, then importance, then creation time, then title |
| `createdAt` | Earlier creation times first, after any manual-order overrides |
| `dueDate` | Earlier due dates first; tasks without due dates sort after tasks with due dates |

### [SPEC-009-D] Automatic score

Automatic ranking starts from `importance * 100`. A skipped task receives a `-90` penalty. Completed state does not affect score.

### [SPEC-009-E] Filter reset behavior

"Reset filters" restores the default state: all contexts, all categories, empty search text, and `importance` sort mode.

## [SPEC-010] Settings behavior

### [SPEC-010-A] Settings navigation

Settings open from the hamburger button and contain two subviews: `Login` and `Categories`. Opening Settings does not auto-select either subview.

### [SPEC-010-B] Login settings

The Login view allows editing:

- data repository owner
- private data repository name
- branch
- GitHub token

The token is stored only in browser local storage. A Refresh button is available when sync is possible.

### [SPEC-010-C] Repository inference

When the app is hosted on `*.github.io`, it infers a default repository owner from the hostname and defaults the live data repository to `todo-app` on branch `main` with `data/tasks.json` and `data/config.json`.

### [SPEC-010-D] Category management

The Categories view allows adding a trimmed category value unless it already exists. Deleting a category removes it from the config and also clears that category from every task that currently uses it.

## [SPEC-011] Sync and persistence rules

### [SPEC-011-A] Mutation preconditions

Task and category mutations are disabled unless all of the following are true:

1. The browser is online.
2. A GitHub token is present.
3. Repository owner, repo, and branch are present.
4. No save is already in progress.

### [SPEC-011-B] Save model

Every mutation fetches the latest remote task and config files, applies the requested change, reflows the task data, and writes the changed JSON back to the repository. Task and config files are written independently depending on which file changed.

### [SPEC-011-C] Conflict handling

If GitHub reports a conflict or SHA mismatch during save, the app retries against fresh remote state up to five attempts with short backoff. If conflicts persist, the app refreshes to the latest remote state and surfaces an error.

## [SPEC-012] PWA and offline behavior

The app registers a service worker on load. The service worker precaches the app shell, uses network-first behavior for navigation and bundled task/config JSON, and uses stale-while-revalidate for static assets.

After the app has been loaded successfully once, the cached shell remains available offline. Offline mode is read-only.

## [SPEC-013] Non-goals in current implementation

The current app does not provide:

- server-side storage or a custom backend
- multi-user collaboration
- local offline write queueing
- multiple categories per task
- archived-task separation from the main dataset
- helper UI for uncategorized-only filtering
