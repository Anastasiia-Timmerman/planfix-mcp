/**
 * Резолвер конфигурации Planfix — общий для CLI и MCP-сервера.
 *
 * Несекретные значения (account, base_url) лежат в ~/.config/planfix/config.json.
 * API-ключ хранится ТОЛЬКО в связке ключей macOS (служба "planfix", аккаунт = субдомен),
 * как пароли в bbmail. В открытом виде ключа на диске и в конфигах больше нет.
 *
 * applyEnvFromConfig() populates process.env, поэтому client.ts (который читает
 * PLANFIX_* из окружения) работает без изменений. Приоритет: уже заданный env > config/Keychain.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface PlanfixConfig {
  account?: string;
  base_url?: string;
}

const CONFIG_PATH = join(homedir(), ".config", "planfix", "config.json");
const KEYCHAIN_SERVICE = "planfix";

export function loadConfigFile(): PlanfixConfig {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as PlanfixConfig;
  } catch {
    return {};
  }
}

/** Прочитать API-ключ из Keychain (служба "planfix", аккаунт = субдомен). */
export function keychainGet(account: string): string | undefined {
  try {
    const out = execFileSync(
      "security",
      ["find-generic-password", "-s", KEYCHAIN_SERVICE, "-a", account, "-w"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    const trimmed = out.trim();
    return trimmed.length ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

export function applyEnvFromConfig(): void {
  const cfg = loadConfigFile();

  if (!process.env.PLANFIX_ACCOUNT && cfg.account) {
    process.env.PLANFIX_ACCOUNT = cfg.account;
  }
  if (!process.env.PLANFIX_BASE_URL && cfg.base_url) {
    process.env.PLANFIX_BASE_URL = cfg.base_url;
  }
  if (!process.env.PLANFIX_API_KEY) {
    const account = process.env.PLANFIX_ACCOUNT ?? cfg.account;
    if (account) {
      const key = keychainGet(account);
      if (key) process.env.PLANFIX_API_KEY = key;
    }
  }
}

export function configSummary(): { account?: string; baseUrl?: string; keyPresent: boolean } {
  return {
    account: process.env.PLANFIX_ACCOUNT,
    baseUrl: process.env.PLANFIX_BASE_URL,
    keyPresent: Boolean(process.env.PLANFIX_API_KEY),
  };
}
