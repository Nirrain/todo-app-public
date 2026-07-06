import type { RepositoryJsonFile, SyncSettings } from "../types";

const PUBLIC_APP_REPO = "todo-app-public";
const PRIVATE_DATA_REPO = "todo-app";

function inferGitHubPagesRepo(): Partial<SyncSettings> {
  if (typeof window === "undefined") {
    return {};
  }

  const { hostname, pathname } = window.location;

  if (!hostname.endsWith(".github.io")) {
    return {};
  }

  const owner = hostname.split(".")[0] ?? "";
  const segments = pathname.split("/").filter(Boolean);
  const hostedRepo = segments[0] ?? "";

  if (hostedRepo && hostedRepo !== PUBLIC_APP_REPO) {
    return {
      owner,
      repo: PRIVATE_DATA_REPO,
      branch: "main",
      tasksPath: "data/tasks.json",
      configPath: "data/config.json",
    };
  }

  return {
    owner,
    repo: PRIVATE_DATA_REPO,
    branch: "main",
    tasksPath: "data/tasks.json",
    configPath: "data/config.json",
  };
}

function ensureRepoSettings(settings: SyncSettings): void {
  if (!settings.owner || !settings.repo || !settings.branch) {
    throw new Error("Repository owner, repo, and branch are required for GitHub sync.");
  }
}

function encodeJsonFile(data: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(data, null, 2));
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function decodeJsonFile<T>(content: string): T {
  const normalized = content.replace(/\n/g, "");
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

async function requestGitHubJson<T>(url: string | URL, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "GitHub API request failed.");
  }

  return (await response.json()) as T;
}

export function getDefaultSyncSettings(): SyncSettings {
  return {
    token: "",
    owner: "",
    repo: "",
    branch: "main",
    tasksPath: "data/tasks.json",
    configPath: "data/config.json",
    ...inferGitHubPagesRepo(),
  };
}

export async function fetchRepositoryJsonFile<T>(
  settings: SyncSettings,
  path: string,
  token = "",
): Promise<RepositoryJsonFile<T>> {
  ensureRepoSettings(settings);

  const url = new URL(
    `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${path}`,
  );
  url.searchParams.set("ref", settings.branch);

  const data = await requestGitHubJson<{ sha: string; content: string }>(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  return {
    sha: data.sha,
    content: decodeJsonFile<T>(data.content),
  };
}

export async function updateRepositoryJsonFile(
  settings: SyncSettings,
  path: string,
  data: unknown,
  sha: string,
  token: string,
  message: string,
): Promise<unknown> {
  ensureRepoSettings(settings);

  if (!token) {
    throw new Error("A GitHub token is required to push repository changes.");
  }

  const url = `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${path}`;

  return requestGitHubJson(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      branch: settings.branch,
      message,
      sha,
      content: encodeJsonFile(data),
    }),
  });
}
