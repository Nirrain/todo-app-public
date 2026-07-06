import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AppConfig, TasksFile } from "../src/types";
import { reflowTasks } from "../src/logic/reflowEngine";

const rootDir = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const tasksPath = resolve(rootDir, "data", "tasks.json");
const configPath = resolve(rootDir, "data", "config.json");

const [rawTasks, rawConfig] = await Promise.all([
  readFile(tasksPath, "utf8"),
  readFile(configPath, "utf8"),
]);

const tasksFile = JSON.parse(rawTasks) as TasksFile;
const config = JSON.parse(rawConfig) as AppConfig;
const reflowedTasks = reflowTasks(tasksFile.tasks ?? [], { config });

await writeFile(
  tasksPath,
  `${JSON.stringify({ tasks: reflowedTasks }, null, 2)}\n`,
  "utf8",
);

