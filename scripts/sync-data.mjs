import { mkdir, copyFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const sourceDir = resolve(rootDir, "data");
const targetDir = resolve(rootDir, "public", "data");

await mkdir(targetDir, { recursive: true });
await copyFile(resolve(sourceDir, "tasks.json"), resolve(targetDir, "tasks.json"));
await copyFile(resolve(sourceDir, "config.json"), resolve(targetDir, "config.json"));

