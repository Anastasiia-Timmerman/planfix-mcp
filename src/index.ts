#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "node:http";

import { getTasksSchema, handleGetTasks, getTaskSchema, handleGetTask, createTaskSchema, handleCreateTask, updateTaskSchema, handleUpdateTask } from "./tools/tasks.js";
import { getContactsSchema, handleGetContacts, getContactSchema, handleGetContact } from "./tools/contacts.js";
import { getProjectsSchema, handleGetProjects, getProjectSchema, handleGetProject } from "./tools/projects.js";
import { getCommentsSchema, handleGetComments, addCommentSchema, handleAddComment } from "./tools/comments.js";
import { skillMyTasks, skillCreateTask } from "./skills.js";

const VERSION = "1.1.0";

export function createPlanfixServer(): McpServer {
  const server = new McpServer({
    name: "planfix-mcp",
    version: VERSION,
  });

  server.tool(
    "get_tasks",
    "Получить список задач из Planfix с пагинацией и фильтрами.",
    getTasksSchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleGetTasks(params) }] }),
  );

  server.tool(
    "get_task",
    "Получить одну задачу по ID.",
    getTaskSchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleGetTask(params) }] }),
  );

  server.tool(
    "create_task",
    "Создать новую задачу в Planfix.",
    createTaskSchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleCreateTask(params) }] }),
  );

  server.tool(
    "update_task",
    "Обновить существующую задачу в Planfix (название, описание, статус, исполнитель).",
    updateTaskSchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleUpdateTask(params) }] }),
  );

  server.tool(
    "get_contacts",
    "Получить список контактов из Planfix с пагинацией и фильтрами.",
    getContactsSchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleGetContacts(params) }] }),
  );

  server.tool(
    "get_contact",
    "Получить одного контакта по ID.",
    getContactSchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleGetContact(params) }] }),
  );

  server.tool(
    "get_projects",
    "Получить список проектов из Planfix.",
    getProjectsSchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleGetProjects(params) }] }),
  );

  server.tool(
    "get_project",
    "Получить один проект по ID.",
    getProjectSchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleGetProject(params) }] }),
  );

  server.tool(
    "get_comments",
    "Получить комментарии к задаче.",
    getCommentsSchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleGetComments(params) }] }),
  );

  server.tool(
    "add_comment",
    "Добавить комментарий к задаче.",
    addCommentSchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleAddComment(params) }] }),
  );

  skillMyTasks(server);
  skillCreateTask(server);

  return server;
}

async function startHttpServer(port: number): Promise<void> {
  const transports = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);

    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", version: VERSION }));
      return;
    }

    if (url.pathname !== "/mcp") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (req.method === "POST" || req.method === "GET" || req.method === "DELETE") {
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports.has(sessionId)) {
        transport = transports.get(sessionId)!;
      } else if (req.method === "POST" && !sessionId) {
        transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => crypto.randomUUID() });
        const server = createPlanfixServer();
        await server.connect(transport);

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid) transports.delete(sid);
        };

        await transport.handleRequest(req, res);

        const newSid = res.getHeader("mcp-session-id") as string | undefined;
        if (newSid) transports.set(newSid, transport);
        return;
      } else {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "No valid session" }));
        return;
      }

      await transport.handleRequest(req, res);
    } else {
      res.writeHead(405);
      res.end("Method not allowed");
    }
  });

  httpServer.listen(port, () => {
    console.error(`[planfix-mcp] HTTP server on http://localhost:${port}/mcp`);
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const httpIndex = args.indexOf("--http");

  if (httpIndex !== -1) {
    const port = parseInt(args[httpIndex + 1] ?? "8080", 10);
    await startHttpServer(port);
  } else {
    const server = createPlanfixServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`[planfix-mcp] v${VERSION} запущен. 10 инструментов, 2 навыка. Stdio.`);
  }
}

main().catch((error) => {
  console.error("[planfix-mcp] Ошибка:", error);
  process.exit(1);
});
