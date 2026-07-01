#!/usr/bin/env node

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const serverPath = path.join(repoRoot, "dist", "index.js");
const logDir = path.join(os.homedir(), "Library", "Logs", "Claude");
const logPath = path.join(logDir, "planfix-mcp-launcher.log");

function writeLog(message) {
  const line = `${new Date().toISOString()} ${message}\n`;
  try {
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(logPath, line);
  } catch {
    // Claude still captures stderr if the file log cannot be written.
  }
  process.stderr.write(`[planfix-launcher] ${message}\n`);
}

function exitWithError(message) {
  writeLog(`fatal: ${message}`);
  process.exit(1);
}

process.chdir(repoRoot);

if (!fs.existsSync(serverPath)) {
  exitWithError(`server build not found at ${serverPath}`);
}

const requiredEnv = ["PLANFIX_ACCOUNT", "PLANFIX_API_KEY"];
const missingEnv = requiredEnv.filter((name) => !process.env[name]);
if (missingEnv.length > 0) {
  exitWithError(`missing env: ${missingEnv.join(", ")}`);
}

writeLog(`starting ${serverPath}`);

const child = spawn(process.execPath, [serverPath], {
  cwd: repoRoot,
  env: process.env,
  stdio: ["inherit", "inherit", "pipe"],
});

child.stderr.on("data", (chunk) => {
  const text = chunk.toString();
  try {
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(logPath, text);
  } catch {
    // Keep stderr flowing to Claude even if the side log cannot be written.
  }
  process.stderr.write(text);
});

child.on("error", (error) => {
  exitWithError(`spawn failed: ${error.message}`);
});

child.on("exit", (code, signal) => {
  writeLog(`server exited code=${code ?? "null"} signal=${signal ?? "null"}`);
  process.exit(code ?? (signal ? 1 : 0));
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    writeLog(`received ${signal}, forwarding to server`);
    child.kill(signal);
  });
}
