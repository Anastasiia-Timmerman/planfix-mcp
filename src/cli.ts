#!/usr/bin/env node
/**
 * planfix — CLI поверх того же ядра, что и MCP-сервер (client.ts + tools/).
 * Для Claude Code: `planfix <команда> --флаг значение`.
 * Ключ берётся из Keychain через config.ts — как в bbmail. Дублирования логики нет:
 * все команды вызывают те же handleXxx, что зарегистрированы в index.ts как MCP-инструменты.
 */
import { z } from "zod";
import { applyEnvFromConfig, configSummary } from "./config.js";
import {
  getTasksSchema, handleGetTasks,
  getTaskSchema, handleGetTask,
  getTaskChecklistSchema, handleGetTaskChecklist,
  createTaskSchema, handleCreateTask,
  updateTaskSchema, handleUpdateTask,
} from "./tools/tasks.js";
import { getContactsSchema, handleGetContacts, getContactSchema, handleGetContact } from "./tools/contacts.js";
import {
  getProjectsSchema, handleGetProjects,
  getProjectSchema, handleGetProject,
  createProjectSchema, handleCreateProject,
  updateProjectSchema, handleUpdateProject,
} from "./tools/projects.js";
import { getCommentsSchema, handleGetComments, addCommentSchema, handleAddComment } from "./tools/comments.js";
import { linkTasksSchema, handleLinkTasks } from "./tools/relations.js";
import { getStatusesSchema, handleGetStatuses } from "./tools/statuses.js";
import {
  getTemplatesSchema,
  handleGetTaskCustomFields, handleGetProjectCustomFields,
  handleGetTaskTemplates, handleGetProjectTemplates,
} from "./tools/directories.js";

type Handler = (params?: any) => Promise<string>;

interface Command {
  handler: Handler;
  schema?: z.ZodTypeAny;
  noArgs?: boolean;
  help: string;
}

const COMMANDS: Record<string, Command> = {
  "tasks":             { handler: handleGetTasks,            schema: getTasksSchema,          help: "список задач [--projectId --statusId --pageSize --dateFrom --dateTo]" },
  "task":              { handler: handleGetTask,             schema: getTaskSchema,           help: "одна задача --taskId [--includeDescription]" },
  "task-checklist":    { handler: handleGetTaskChecklist,    schema: getTaskChecklistSchema,  help: "чек-лист задачи --taskId" },
  "create-task":       { handler: handleCreateTask,          schema: createTaskSchema,        help: "создать задачу --name [--description --projectId --assigneeId ...]" },
  "update-task":       { handler: handleUpdateTask,          schema: updateTaskSchema,        help: "обновить задачу --taskId [--status --description ...]" },
  "contacts":          { handler: handleGetContacts,         schema: getContactsSchema,       help: "список контактов" },
  "contact":           { handler: handleGetContact,          schema: getContactSchema,        help: "один контакт --contactId" },
  "projects":          { handler: handleGetProjects,         schema: getProjectsSchema,       help: "список проектов" },
  "project":           { handler: handleGetProject,          schema: getProjectSchema,        help: "один проект --projectId" },
  "create-project":    { handler: handleCreateProject,       schema: createProjectSchema,     help: "создать проект --name [--description --ownerId ...]" },
  "update-project":    { handler: handleUpdateProject,       schema: updateProjectSchema,     help: "обновить проект --projectId [...]" },
  "comments":          { handler: handleGetComments,         schema: getCommentsSchema,       help: "комментарии задачи --taskId" },
  "add-comment":       { handler: handleAddComment,          schema: addCommentSchema,        help: "добавить комментарий --taskId --body" },
  "link-tasks":        { handler: handleLinkTasks,           schema: linkTasksSchema,         help: "(связи задач Planfix REST не поддерживает)" },
  "statuses":          { handler: handleGetStatuses,         schema: getStatusesSchema,       help: "справочник статусов" },
  "task-fields":       { handler: () => handleGetTaskCustomFields(),    noArgs: true, help: "кастомные поля задач" },
  "project-fields":    { handler: () => handleGetProjectCustomFields(), noArgs: true, help: "кастомные поля проектов" },
  "task-templates":    { handler: handleGetTaskTemplates,    schema: getTemplatesSchema,      help: "шаблоны задач" },
  "project-templates": { handler: handleGetProjectTemplates, schema: getTemplatesSchema,      help: "шаблоны проектов" },
};

/** Привести значение флага к числу/булеву/JSON, иначе оставить строкой. */
function coerce(value: string): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+$/.test(value)) return Number(value);
  const t = value.trim();
  if (t.startsWith("[") || t.startsWith("{")) {
    try { return JSON.parse(t); } catch { /* оставить строкой */ }
  }
  return value;
}

function parseArgs(argv: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (!tok.startsWith("--")) continue;
    let key = tok.slice(2);
    let value: string | undefined;
    const eq = key.indexOf("=");
    if (eq !== -1) {
      value = key.slice(eq + 1);
      key = key.slice(0, eq);
    } else {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        value = next;
        i++;
      }
    }
    out[key] = value === undefined ? true : coerce(value);
  }
  // --json '{...}' — передать целиком объект параметров (для сложных случаев)
  if (out.json && typeof out.json === "object") {
    const extra = out.json as Record<string, unknown>;
    delete out.json;
    Object.assign(out, extra);
  }
  return out;
}

function printHelp(): void {
  const lines = ["planfix — CLI для Planfix REST (Claude Code)", "", "Команды:"];
  for (const [name, cmd] of Object.entries(COMMANDS)) {
    lines.push(`  ${name.padEnd(18)} ${cmd.help}`);
  }
  lines.push(`  ${"accounts".padEnd(18)} показать аккаунт/URL и есть ли ключ в Keychain`);
  lines.push("");
  lines.push("Примеры:");
  lines.push("  planfix tasks --pageSize 5");
  lines.push("  planfix task --taskId 10743 --includeDescription");
  lines.push('  planfix add-comment --taskId 10743 --body "Готово"');
  lines.push('  planfix create-task --name "Тест" --projectId 5');
  lines.push("");
  lines.push("Сложные параметры — через --json:");
  lines.push(`  planfix create-task --json '{"name":"X","assignees":{"users":[1]}}'`);
  console.log(lines.join("\n"));
}

async function main(): Promise<void> {
  applyEnvFromConfig();
  const [command, ...rest] = process.argv.slice(2);

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }
  if (command === "accounts" || command === "whoami") {
    console.log(JSON.stringify(configSummary(), null, 2));
    return;
  }

  const cmd = COMMANDS[command];
  if (!cmd) {
    console.error(`Неизвестная команда: ${command}. Запусти "planfix help".`);
    process.exit(1);
  }

  const params = parseArgs(rest);
  try {
    if (cmd.noArgs) {
      console.log(await cmd.handler());
      return;
    }
    const validated = cmd.schema ? cmd.schema.parse(params) : params;
    console.log(await cmd.handler(validated));
  } catch (error) {
    const message = error instanceof z.ZodError
      ? `неверные параметры: ${error.issues.map((i) => `${i.path.join(".") || "(корень)"} — ${i.message}`).join("; ")}`
      : error instanceof Error ? error.message : String(error);
    console.error(`Ошибка: ${message}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("planfix CLI fatal:", error);
  process.exit(1);
});
