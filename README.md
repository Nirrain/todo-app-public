# Top 10 Tasks

Top 10 Tasks is a TypeScript React + Vite Progressive Web App that is intended to run from the public **`todo-app-public`** repository while reading and writing task data in the private **`todo-app`** repository. It uses only standard GitHub features: **GitHub Pages** for hosting, **GitHub Actions** for automation, and repository JSON files for persistence.

## Features

- Top-10 task view with indoor/outdoor, importance, category, due date, notes, and big-win metadata
- Compact mobile-first layout with the task list at the top of the screen
- Inline editing directly from the visible top-10 task cards
- Hamburger-menu settings panel with separate Login and Categories submenus
- Manual reprioritization with drag-and-drop plus move up/down controls
- Skip, complete-flag, and automatic reflow behavior
- Immediate GitHub sync on every task change
- Browser-based GitHub sync with no backend server
- Repository automation for GitHub Pages deployment and task reflow

## Repository split

- **Public app repo:** `todo-app-public`
- **Private data repo:** `todo-app`
- **Hosted app:** GitHub Pages from `todo-app-public`
- **JSON source of truth:** `data/tasks.json` and `data/config.json` in `todo-app`

The public repo can still include sample JSON so the app has a usable offline bundle, but the intended live read/write target is the private `todo-app` repository.

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

`npm run build` produces the static site in `dist/`. The build copies `data/*.json` into the served app as bundled fallback data, injects the custom service worker, and prepares the app for GitHub Pages in `todo-app-public`.

## Deploying with GitHub Pages

1. Push this app repository to **`todo-app-public`**.
2. In **Settings → Pages**, set **Build and deployment** to **GitHub Actions**.
3. Ensure the default branch is `main` or update `.github/workflows/pages.yml` to match your branch.
4. Push again or run the **Deploy Pages** workflow manually.

After deployment, the app is available on the GitHub Pages URL for `todo-app-public`.

> **Important:** the workflow alone is not enough if Pages is still configured as **Deploy from branch**. If the deployed URL shows a blank page or a loading notice forever, check **Settings → Pages** and switch the site to **GitHub Actions**. A legacy Pages configuration will serve the raw repository `index.html` instead of the built `dist/` artifact.

## Installing the PWA on iPhone

1. Open the deployed GitHub Pages URL in Safari.
2. Tap **Share**.
3. Choose **Add to Home Screen**.
4. Launch **Top 10 Tasks** from the home screen like a normal app.

The service worker caches the app shell and task data so the app stays usable offline after the first successful load.

## GitHub token setup

The app reads and writes changes directly to the private `todo-app/data/tasks.json` file through the GitHub REST API. To enable sync:

1. Open GitHub **Settings → Developer settings → Personal access tokens**.
2. Create a token with permission to read and write repository contents.
   - Fine-grained token: **Contents: Read and write**
   - Classic token: `repo` is required because the data repository is private
3. Open the app, open the hamburger menu, and use **Login** to fill in:
   - **Data repository owner**
   - **Private data repository** (`todo-app`)
   - **Branch**
   - **GitHub token**

When hosted from a GitHub Pages URL, the app defaults the data repository to `todo-app` under the same owner. The token is stored only in the browser's localStorage and is edited from the **Login** submenu.

## How syncing works

- The published bundle in `todo-app-public` provides fallback JSON for first load and read-only use before credentials are configured.
- After the private repository credentials are configured, the app refreshes from the live private repository.
- Adding, editing, skipping, completing, and manual reordering each trigger an immediate write to the private `todo-app` repository.
- Each save fetches the latest remote `data/tasks.json`, applies the requested change, reflows the task order, and writes the updated JSON back.
- If GitHub reports a conflicting file update during save, the app retries once against the latest remote version before surfacing an error.
- If you are offline, task mutations are disabled instead of being queued locally.

If a token is already stored in the browser, the app automatically refreshes from the private data repository when it starts online.

## How auto-reflow works

Automatic reflow happens in two places:

1. **In the app** whenever a task is skipped, completed, or manual ordering is cleared.
2. **In GitHub Actions** via `.github/workflows/reflow.yml` in the repository that owns the live data.

The reflow logic:

- fully re-sorts tasks using the priority engine
- deprioritizes skipped tasks without hiding them
- preserves the top-ten limit
- does not add decay, escalation, splitting, or grouping

Completed tasks are kept in the repository with a `completed` flag instead of being deleted, and task changes update a `changedAt` timestamp.

If you keep the app in `todo-app-public` and the live JSON in private `todo-app`, the reflow workflow should run from the private `todo-app` repository where `data/tasks.json` actually changes.

## Editing and manual reprioritization

- Tap **Edit** on any visible task to change its title, notes, context, importance, category, or big-win flag directly in the top-10 list.
- Tasks can optionally include a due date.
- Saving an edit writes the change directly to the private repository.
- Drag a visible task onto another visible task to reorder it.
- On touch devices, use **Move up** and **Move down**.
- Manual order takes precedence over automatic scoring until **Clear manual order** is used.

## Adding tasks

Use the **Add a task** form to provide:

- a one-sentence title
- optional notes
- indoor/outdoor context
- importance from 1 to 3
- a single category, chosen from the category list in private `config.json`
- an optional due date
- an optional big-win flag

New tasks are written directly to the private repository.

## Categories

- Category options are stored in the private repository's `data/config.json`.
- Open the hamburger menu and use **Categories** to add or remove allowed values.
- If you remove a category that is still used by tasks, the app clears that category from those tasks automatically while saving the updated config.

## Filters

The app supports:

- indoor/outdoor context filtering
- importance filtering
- category filtering
- configurable sorting by importance, created date, or due date ascending

Tasks without a due date sort after tasks that do have one when **Due date ascending** is selected.

Filters affect which tasks are shown in the current top-ten view. The private `todo-app` repository still keeps the full active task set in `data/tasks.json`.

## Data files

### `data/config.json`

Defines available categories and the top-ten cap:

```json
{
  "categories": ["practical", "creative", "low-effort"],
  "maxVisible": 10
}
```

### `data/tasks.json`

Stores the active task list in the private `todo-app` repository. Core fields are:

- `id`
- `title`
- `notes`
- `context`
- `importance`
- `category`
- `dueDate`
- `bigWin`
- `skipped`
- `completed`
- `createdAt`
- `changedAt`

The implementation also keeps `changedAt`, `updatedAt`, and `manualOrder` metadata so sync and manual reprioritization remain durable.

## License

This project is licensed under the **MIT License**. See [`LICENSE`](./LICENSE).

## Available scripts

```bash
npm run dev      # start local development
npm run build    # create the production bundle
npm run preview  # preview the built site locally
npm run reflow   # apply repository-side task reflow
```
