# Top 10 Tasks

Top 10 Tasks is a TypeScript React + Vite Progressive Web App that runs entirely on standard GitHub features: **GitHub Pages** for hosting, **GitHub Actions** for automation, and repository JSON files for persistence. It keeps a focused top-ten task list, works offline, and syncs `data/tasks.json` back to the repository through the GitHub REST API.

## Features

- Top-10 task view with indoor/outdoor, importance, mood, notes, and big-win metadata
- Inline editing directly from the visible top-10 task cards
- Manual reprioritization with drag-and-drop plus move up/down controls
- Skip, complete, and automatic reflow behavior
- Offline-first PWA with a service worker and local cache
- Browser-based GitHub sync with no backend server
- Repository automation for GitHub Pages deployment and task reflow

## Repository structure

```text
.
├── .github/workflows/
│   ├── pages.yml
│   └── reflow.yml
├── data/
│   ├── config.json
│   └── tasks.json
├── public/
│   ├── icon.svg
│   └── styles.css
├── scripts/
│   ├── reflow.ts
│   └── sync-data.mjs
├── src/
│   ├── components/
│   ├── logic/
│   └── pwa/
├── functional-req.md
├── index.html
├── package.json
└── vite.config.js
```

## Local development

```bash
npm install
npm run dev
```

`npm run build` produces the static site in `dist/`. The build copies `data/*.json` into the served app, injects the custom service worker, and prepares the app for GitHub Pages.

## Deploying with GitHub Pages

1. Push the repository to GitHub.
2. In **Settings → Pages**, set **Build and deployment** to **GitHub Actions**.
3. Ensure the default branch is `main` or update `.github/workflows/pages.yml` to match your branch.
4. Push again or run the **Deploy Pages** workflow manually.

After deployment, the app is available on the repository's GitHub Pages URL.

## Installing the PWA on iPhone

1. Open the deployed GitHub Pages URL in Safari.
2. Tap **Share**.
3. Choose **Add to Home Screen**.
4. Launch **Top 10 Tasks** from the home screen like a normal app.

The service worker caches the app shell and task data so the app stays usable offline after the first successful load.

## GitHub token setup

The app writes changes directly to `data/tasks.json` through the GitHub REST API. To enable sync:

1. Open GitHub **Settings → Developer settings → Personal access tokens**.
2. Create a token with permission to read and write repository contents.
   - Fine-grained token: **Contents: Read and write**
   - Classic token: `repo` for private repos or `public_repo` for public repos
3. Open the app and fill in:
   - **Repository owner**
   - **Repository name**
   - **Branch**
   - **GitHub token**

The token is stored only in the current browser via localStorage.

## How syncing works

- The app always works against a local cache first.
- New tasks, skips, completions, and manual reorder changes are stored locally immediately.
- When **Sync now** runs, the app fetches the latest repository copy of `data/tasks.json`, applies pending local changes, reflows the task order, and writes the updated JSON back to GitHub.
- If you are offline, changes remain queued locally until sync succeeds.
- If GitHub reports a conflicting file update, the app surfaces the error instead of silently discarding data.

## How auto-reflow works

Automatic reflow happens in two places:

1. **In the app** whenever a task is skipped, completed, or manual ordering is cleared.
2. **In GitHub Actions** via `.github/workflows/reflow.yml` whenever `data/tasks.json` changes or the workflow is dispatched manually.

The reflow logic:

- fully re-sorts tasks using the priority engine
- deprioritizes skipped tasks without hiding them
- preserves the top-ten limit
- does not add decay, escalation, splitting, or grouping

## Editing and manual reprioritization

- Tap **Edit** on any visible task to change its title, notes, context, importance, mood tags, or big-win flag directly in the top-10 list.
- Saving an edit updates the local cache immediately and queues the change for GitHub sync.
- Drag a visible task onto another visible task to reorder it.
- On touch devices, use **Move up** and **Move down**.
- Manual order takes precedence over automatic scoring until **Clear manual order** is used.

## Adding tasks

Use the **Add a task** form to provide:

- a one-sentence title
- optional notes
- indoor/outdoor context
- importance from 1 to 3
- one or more mood tags
- an optional big-win flag

New tasks are cached instantly and can then be synced back to GitHub.

## Filters

The app supports:

- indoor/outdoor context filtering
- importance filtering
- mood tag filtering

Filters affect which tasks are shown in the current top-ten view. The repository still keeps the full active task set in `data/tasks.json`.

## Data files

### `data/config.json`

Defines available moods and the top-ten cap:

```json
{
  "moods": ["practical", "creative", "low-effort"],
  "maxVisible": 10
}
```

### `data/tasks.json`

Stores the active task list. Core fields are:

- `id`
- `title`
- `notes`
- `context`
- `importance`
- `mood`
- `bigWin`
- `skipped`
- `createdAt`

The implementation also keeps `updatedAt` and `manualOrder` metadata so sync and manual reprioritization remain durable.

## Available scripts

```bash
npm run dev      # start local development
npm run build    # create the production bundle
npm run preview  # preview the built site locally
npm run reflow   # apply repository-side task reflow
```
