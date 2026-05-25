#!/usr/bin/env node
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const port = process.env.PORT || "3000";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const nextBin = join(root, "node_modules/next/dist/bin/next");

console.log(`ELY web listening on ${hostname}:${port}`);

const child = spawn(process.execPath, [nextBin, "start", "-H", hostname, "-p", port], {
  stdio: "inherit",
  env: process.env,
  cwd: root,
});

child.on("exit", (code) => process.exit(code ?? 1));
