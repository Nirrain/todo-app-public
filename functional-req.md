# Functional Requirements

## 1. Product Overview

The application shall be a lightweight personal task manager implemented as a Progressive Web App (PWA). It shall be optimized for use on iPhone while remaining accessible in standard web browsers. The application shall help a single user maintain a prioritized list of personal tasks, display only the top ten relevant tasks, and support quick task capture, filtering, reprioritization, completion, skipping, offline use, and synchronization through GitHub.

The application shall be deployable and usable using only standard GitHub functionality. Hosting shall be provided by GitHub Pages. Automation shall be provided by GitHub Actions. Persistent data shall be stored in JSON files committed to the repository. The application shall not require any custom backend service, external database, hosted API server, cloud function, or separate frontend/backend deployment. Any remote data access shall use the GitHub REST API directly from the browser against repository files.

## 2. Users and Operating Context

The primary user is an individual managing personal tasks from an iPhone. The application shall support quick review and adjustment of tasks based on current context, category, and importance. The expected usage pattern is frequent lightweight interaction rather than complex project management.

The application shall support installation as a PWA on iPhone through the browser's standard "Add to Home Screen" functionality. Once installed, it shall behave like a simple standalone mobile app. It shall remain usable when offline by loading cached static assets and locally cached task data. When connectivity is available, it shall synchronize task data with the GitHub repository.

## 3. Deployment and Accessibility Requirements

1. The application shall be buildable as a static React + Vite application.
2. The production application shall be deployable to GitHub Pages from the same repository.
3. The deployed application shall be accessible through the repository's GitHub Pages URL without requiring a separate hosting provider.
4. The repository shall include all source code, static assets, PWA configuration, sample data, and GitHub Actions workflows required to operate the app.
5. The application shall require no backend server controlled by the app developer.
6. The application shall require no external database service.
7. The application shall require no separate API deployment.
8. The only remote service dependency for persistence and automation shall be GitHub itself: GitHub Pages, GitHub REST API, repository file storage, and GitHub Actions.
9. The application shall provide clear user-facing instructions for configuring a GitHub token used by the browser to read and update repository JSON data.
10. The application shall not depend on private runtime infrastructure beyond the user's GitHub account and repository permissions.

## 4. Core Task Data Requirements

Tasks shall be persisted in `/data/tasks.json`. Configuration values shall be persisted in `/data/config.json`. The data model shall be simple JSON that can be reviewed and edited through normal GitHub repository functionality.

Each task shall contain:

| Field | Requirement |
| --- | --- |
| `id` | Unique task identifier, preferably a UUID. |
| `title` | Required short task title or one-sentence task description. |
| `notes` | Optional longer notes, stored as a string or `null`. |
| `context` | Required value of `indoor` or `outdoor`. |
| `importance` | Required numeric value from 1 to 3. |
| `category` | Optional single category value, such as `practical`, `creative`, or `low-effort`. |
| `skipped` | Boolean indicating whether the user has skipped the task. |
| `completed` | Boolean indicating whether the task is marked complete. |
| `createdAt` | ISO timestamp representing task creation time. |
| `changedAt` | ISO timestamp representing the last meaningful task change. |

The configuration file shall define available categories and the maximum number of visible tasks. The default maximum visible task count shall be ten.

## 5. Task List and Prioritization Requirements

The application shall always present a top-ten task view as the primary interface. It shall rank tasks using a priority engine and display only the first ten tasks after sorting and filtering. Lower-ranked tasks may remain stored in the repository but shall not appear in the primary list unless they enter the top ten.

The priority engine shall rank tasks using at least the following factors:

1. Current indoor or outdoor context.
2. Task importance from 1 to 3.
3. Manual reprioritization overrides.
4. The configured maximum visible count.

Manual reprioritization shall allow the user to reorder tasks, including by drag-to-reorder or an equivalent mobile-friendly interaction. Manual ordering shall influence the ranked result while preserving the ability to return to automated prioritization when manual overrides are removed.

## 6. Task Management Requirements

The application shall allow the user to add a task using a compact form. The form shall include:

1. A required one-sentence task title.
2. Optional notes.
3. Indoor or outdoor context selection.
4. Importance selection from 1 to 3.
5. Optional category selection.
6. Optional due date.

The application shall allow the user to complete a task. Completed tasks shall remain stored with a completion flag and may still appear in the task list according to current sorting and filters.

The application shall allow the user to skip a task. Skipped tasks shall not be deleted. A skipped task shall be deprioritized during reflow but shall remain in stored data and may reappear later if its ranking places it in the top ten. Skipping shall trigger a task reflow.

The application shall allow task notes to be expanded and collapsed from each task item. Task list items shall show the task title, context, importance, category, and actions for completion and skipping.

## 7. Filtering Requirements

The application shall provide filters for:

1. Indoor and outdoor context as independent toggles.
2. Category on/off toggles for each configured category.
3. Free-text filtering.
4. Sort mode selection for importance, created date, and due date ascending.

Filtering shall affect the visible ranked task list. The filter controls shall be usable on iPhone-sized screens and shall not require desktop-only interactions. Filters shall work with offline cached data as well as synchronized remote data.

## 8. Reflow Requirements

The application shall reflow tasks when a task is skipped, when a task is completed, or when a manual override is removed. Reflow shall perform a full re-sort using the priority engine.

Reflow shall follow these rules:

1. Skipped tasks are deprioritized but not hidden solely because they were skipped.
2. No decay behavior is required.
3. No escalation behavior is required.
4. No automatic task splitting is required.
5. No automatic grouping is required.
6. Reflow shall preserve the top-ten display constraint.

A GitHub Actions workflow shall also support reflow outside the browser. The workflow shall run when `/data/tasks.json` changes and through manual dispatch. It shall check out the repository, run a Node-based reflow script or equivalent project command, update `/data/tasks.json`, and commit the resulting changes back to the repository when necessary.

## 9. Offline and Synchronization Requirements

The application shall function offline after initial load or installation as a PWA. The service worker shall cache static assets required to open and use the app. It shall also support cached access to task and configuration data.

Local storage shall use localStorage for sync settings. Task changes shall synchronize directly with GitHub when online rather than being queued locally.

Synchronization shall use the GitHub REST API directly from the browser. At minimum, the app shall support reading `/data/tasks.json` and writing updated `/data/tasks.json` back to the repository using authenticated API requests. Authentication shall use a GitHub token entered and stored in the browser by the user. The app shall document the token permissions needed.

The storage layer shall handle merging local changes with remote data in a predictable way. It shall avoid silently discarding local changes. If a conflict cannot be resolved automatically, the app shall surface the issue to the user rather than failing silently.

## 10. PWA Requirements

The repository shall include a web app manifest defining the application name, display mode, icons, start URL, and relevant offline settings. The repository shall include a service worker that caches the application shell, static assets, `/data/tasks.json`, and `/data/config.json` where appropriate.

The PWA shall be usable from the iPhone home screen after installation. It shall have a mobile-friendly layout, touch-friendly controls, readable task cards, and controls that can be used without a physical keyboard.

## 11. Repository and Documentation Requirements

The repository shall include a README with instructions for:

1. Deploying the app with GitHub Pages.
2. Installing the PWA on iPhone.
3. Generating and storing a GitHub token.
4. Adding tasks.
5. Completing, skipping, and manually reprioritizing tasks.
6. Using filters.
7. Understanding sync behavior.
8. Understanding automatic reflow through GitHub Actions.

The generated application shall be self-contained in the repository and suitable for regeneration or extension by Copilot using this requirements document as context.
