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

// Ключ и аккаунт больше не передаются в открытом виде через конфиг Claude Desktop.
// Несекретное (account, base_url) берём из ~/.config/planfix/config.json,
// API-ключ — из связки ключей macOS (служба "planfix"), как пароли в bbmail.
// Сервер (config.ts) делает то же самое; здесь дублируем на уровне лаунчера,
// чтобы дочерний процесс гарантированно получил окружение.
const { execFileSync } = require("node:child_process");

function loadPlanfixConfig() {
  try {
    const p = path.join(os.homedir(), ".config", "planfix", "config.json");
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

function keychainGet(account) {
  try {
    return execFileSync(
      "security",
      ["find-generic-password", "-s", "planfix", "-a", account, "-w"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
  } catch {
    return "";
  }
}

const planfixConfig = loadPlanfixConfig();
if (!process.env.PLANFIX_ACCOUNT && planfixConfig.account) process.env.PLANFIX_ACCOUNT = planfixConfig.account;
if (!process.env.PLANFIX_BASE_URL && planfixConfig.base_url) process.env.PLANFIX_BASE_URL = planfixConfig.base_url;
if (!process.env.PLANFIX_API_KEY) {
  const account = process.env.PLANFIX_ACCOUNT || planfixConfig.account;
  if (account) {
    const key = keychainGet(account);
    if (key) process.env.PLANFIX_API_KEY = key;
  }
}

const requiredEnv = ["PLANFIX_ACCOUNT", "PLANFIX_API_KEY"];
const missingEnv = requiredEnv.filter((name) => !process.env[name]);
if (missingEnv.length > 0) {
  exitWithError(`missing config: ${missingEnv.join(", ")}. Проверь ~/.config/planfix/config.json и ключ в Keychain (служба "planfix", аккаунт "${process.env.PLANFIX_ACCOUNT || planfixConfig.account || "?"}").`);
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
