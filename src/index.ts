#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getTasksSchema, handleGetTasks, createTaskSchema, handleCreateTask } from "./tools/tasks.js";
import { getContactsSchema, handleGetContacts } from "./tools/contacts.js";

const server = new McpServer({
  name: "planfix-mcp",
  version: "1.0.0",
});

server.tool(
  "get_tasks",
  "Получить список задач из Planfix с пагинацией и фильтрами.",
  getTasksSchema.shape,
  async (params) => ({ content: [{ type: "text", text: await handleGetTasks(params) }] }),
);

server.tool(
  "create_task",
  "Создать новую задачу в Planfix.",
  createTaskSchema.shape,
  async (params) => ({ content: [{ type: "text", text: await handleCreateTask(params) }] }),
);

server.tool(
  "get_contacts",
  "Получить список контактов из Planfix с пагинацией и фильтрами.",
  getContactsSchema.shape,
  async (params) => ({ content: [{ type: "text", text: await handleGetContacts(params) }] }),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[planfix-mcp] Сервер запущен. 3 инструмента. Требуется PLANFIX_TOKEN.");
}

main().catch((error) => {
  console.error("[planfix-mcp] Ошибка:", error);
  process.exit(1);
});
