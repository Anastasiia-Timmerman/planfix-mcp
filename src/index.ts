#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "node:http";

import { getTasksSchema, handleGetTasks, getTaskSchema, handleGetTask, getTaskChecklistSchema, handleGetTaskChecklist, createTaskSchema, handleCreateTask, updateTaskSchema, handleUpdateTask } from "./tools/tasks.js";
import { getContactsSchema, handleGetContacts, getContactSchema, handleGetContact } from "./tools/contacts.js";
import { getProjectsSchema, handleGetProjects, getProjectSchema, handleGetProject, createProjectSchema, handleCreateProject, updateProjectSchema, handleUpdateProject } from "./tools/projects.js";
import { getCommentsSchema, handleGetComments, addCommentSchema, handleAddComment } from "./tools/comments.js";
import { linkTasksSchema, handleLinkTasks } from "./tools/relations.js";
import { getStatusesSchema, handleGetStatuses } from "./tools/statuses.js";
import { getDirectorySchema, getTemplatesSchema, handleGetTaskCustomFields, handleGetProjectCustomFields, handleGetTaskTemplates, handleGetProjectTemplates } from "./tools/directories.js";
import { skillMyTasks, skillCreateTask } from "./skills.js";

const VERSION = "1.1.0";
const TOOL_TIMEOUT = 65_000;
const PLANFIX_SEARCH_PREFIX = "PLANFIX planfix";

function toolResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

async function runTool<TParams>(
  name: string,
  params: TParams,
  handler: (params: TParams) => Promise<string>,
) {
  const started = Date.now();
  let timeout: NodeJS.Timeout | undefined;
  const timer = new Promise<string>((resolve) => {
    timeout = setTimeout(() => {
      resolve(JSON.stringify({
        result: "fail",
        code: "PLANFIX_MCP_TOOL_TIMEOUT",
        error: `Planfix MCP tool ${name} timed out after ${TOOL_TIMEOUT}ms`,
      }, null, 2));
    }, TOOL_TIMEOUT);
  });

  console.error(`[planfix-mcp] tool ${name} start`);
  try {
    const text = await Promise.race([handler(params), timer]);
    if (timeout) clearTimeout(timeout);
    console.error(`[planfix-mcp] tool ${name} finish ${Date.now() - started}ms`);
    return toolResult(text);
  } catch (error) {
    if (timeout) clearTimeout(timeout);
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[planfix-mcp] tool ${name} error ${Date.now() - started}ms: ${message}`);
    return toolResult(JSON.stringify({
      result: "fail",
      code: "PLANFIX_MCP_TOOL_ERROR",
      error: message,
    }, null, 2));
  }
}

export function createPlanfixServer(): McpServer {
  const server = new McpServer({
    name: "planfix-mcp",
    version: VERSION,
  }) as McpServer & { tool: (...args: any[]) => unknown };

  server.tool(
    "get_tasks",
    `${PLANFIX_SEARCH_PREFIX}:get_tasks task/list список задач Planfix, projectId, statusId, filterId, offset, pageSize.`,
    getTasksSchema.shape,
    async (params) => runTool("get_tasks", params, handleGetTasks),
  );

  server.tool(
    "list_project_tasks",
    `${PLANFIX_SEARCH_PREFIX}:list_project_tasks task/list найти задачи проекта по projectId, list tasks, search tasks by project, список задач внутри проекта.`,
    getTasksSchema.shape,
    async (params) => runTool("list_project_tasks", params, handleGetTasks),
  );

  server.tool(
    "get_task",
    `${PLANFIX_SEARCH_PREFIX}:get_task taskId получить одну задачу Planfix по ID.`,
    getTaskSchema.shape,
    async (params) => runTool("get_task", params, handleGetTask),
  );

  server.tool(
    "get_task_checklist",
    `${PLANFIX_SEARCH_PREFIX}:get_task_checklist taskId получить чек-лист задачи Planfix.`,
    getTaskChecklistSchema.shape,
    async (params) => runTool("get_task_checklist", params, handleGetTaskChecklist),
  );

  server.tool(
    "create_task",
    `${PLANFIX_SEARCH_PREFIX}:create_task write создать новую задачу Planfix, name, description, projectId, assigneeId.`,
    createTaskSchema.shape,
    async (params) => runTool("create_task", params, handleCreateTask),
  );

  server.tool(
    "planfix_create_task",
    `${PLANFIX_SEARCH_PREFIX}:planfix_create_task WRITE ALIAS create_task создать задачу Planfix, name, description, projectId, assigneeId.`,
    createTaskSchema.shape,
    async (params) => runTool("planfix_create_task", params, handleCreateTask),
  );

  server.tool(
    "update_task",
    `${PLANFIX_SEARCH_PREFIX}:update_task write обновить задачу Planfix по taskId, description, status, assigneeId, customFieldData.`,
    updateTaskSchema.shape,
    async (params) => runTool("update_task", params, handleUpdateTask),
  );

  server.tool(
    "planfix_update_task",
    `${PLANFIX_SEARCH_PREFIX}:planfix_update_task WRITE ALIAS update_task обновить задачу Planfix taskId description status customFieldData.`,
    updateTaskSchema.shape,
    async (params) => runTool("planfix_update_task", params, handleUpdateTask),
  );

  server.tool(
    "get_contacts",
    `${PLANFIX_SEARCH_PREFIX}:get_contacts contact/list получить список контактов Planfix с пагинацией и фильтрами.`,
    getContactsSchema.shape,
    async (params) => runTool("get_contacts", params, handleGetContacts),
  );

  server.tool(
    "get_contact",
    `${PLANFIX_SEARCH_PREFIX}:get_contact contactId получить один контакт Planfix по ID.`,
    getContactSchema.shape,
    async (params) => runTool("get_contact", params, handleGetContact),
  );

  server.tool(
    "get_projects",
    `${PLANFIX_SEARCH_PREFIX}:get_projects project/list получить список проектов Planfix, groupId, parentId, statusId, pageSize.`,
    getProjectsSchema.shape,
    async (params) => runTool("get_projects", params, handleGetProjects),
  );

  server.tool(
    "get_project",
    `${PLANFIX_SEARCH_PREFIX}:get_project projectId получить один проект Planfix по ID.`,
    getProjectSchema.shape,
    async (params) => runTool("get_project", params, handleGetProject),
  );

  server.tool(
    "create_project",
    `${PLANFIX_SEARCH_PREFIX}:create_project write создать новый проект Planfix, name, description, ownerId, groupId.`,
    createProjectSchema.shape,
    async (params) => runTool("create_project", params, handleCreateProject),
  );

  server.tool(
    "planfix_create_project",
    `${PLANFIX_SEARCH_PREFIX}:planfix_create_project WRITE ALIAS create_project создать проект Planfix, name, description, ownerId, groupId.`,
    createProjectSchema.shape,
    async (params) => runTool("planfix_create_project", params, handleCreateProject),
  );

  server.tool(
    "update_project",
    `${PLANFIX_SEARCH_PREFIX}:update_project write обновить проект Planfix projectId, name, description, status, ownerId.`,
    updateProjectSchema.shape,
    async (params) => runTool("update_project", params, handleUpdateProject),
  );

  server.tool(
    "planfix_update_project",
    `${PLANFIX_SEARCH_PREFIX}:planfix_update_project WRITE ALIAS update_project обновить проект Planfix projectId, name, description, status.`,
    updateProjectSchema.shape,
    async (params) => runTool("planfix_update_project", params, handleUpdateProject),
  );

  server.tool(
    "get_comments",
    `${PLANFIX_SEARCH_PREFIX}:get_comments taskId получить комментарии задачи Planfix с пагинацией.`,
    getCommentsSchema.shape,
    async (params) => runTool("get_comments", params, handleGetComments),
  );

  server.tool(
    "add_comment",
    `${PLANFIX_SEARCH_PREFIX}:add_comment write добавить комментарий в задачу Planfix, taskId, body, description.`,
    addCommentSchema.shape,
    async (params) => runTool("add_comment", params, handleAddComment),
  );

  server.tool(
    "planfix_add_comment",
    `${PLANFIX_SEARCH_PREFIX}:planfix_add_comment WRITE ALIAS add_comment добавить комментарий Planfix taskId body description.`,
    addCommentSchema.shape,
    async (params) => runTool("planfix_add_comment", params, handleAddComment),
  );

  server.tool(
    "link_tasks",
    `${PLANFIX_SEARCH_PREFIX}:link_tasks связь задач Planfix taskId relatedTaskId FS SS SF FF, сейчас REST unsupported.`,
    linkTasksSchema.shape,
    async (params) => runTool("link_tasks", params, handleLinkTasks),
  );

  server.tool(
    "get_statuses",
    `${PLANFIX_SEARCH_PREFIX}:get_statuses получить справочник статусов задач Planfix processId.`,
    getStatusesSchema.shape,
    async (params) => runTool("get_statuses", params, handleGetStatuses),
  );

  server.tool(
    "get_task_custom_fields",
    `${PLANFIX_SEARCH_PREFIX}:get_task_custom_fields получить справочник кастомных полей задач Planfix id name type.`,
    getDirectorySchema.shape,
    async (params) => runTool("get_task_custom_fields", params, () => handleGetTaskCustomFields()),
  );

  server.tool(
    "get_project_custom_fields",
    `${PLANFIX_SEARCH_PREFIX}:get_project_custom_fields получить справочник кастомных полей проектов Planfix id name type.`,
    getDirectorySchema.shape,
    async (params) => runTool("get_project_custom_fields", params, () => handleGetProjectCustomFields()),
  );

  server.tool(
    "get_task_templates",
    `${PLANFIX_SEARCH_PREFIX}:get_task_templates получить список шаблонов задач Planfix templateId name.`,
    getTemplatesSchema.shape,
    async (params) => runTool("get_task_templates", params, handleGetTaskTemplates),
  );

  server.tool(
    "get_project_templates",
    `${PLANFIX_SEARCH_PREFIX}:get_project_templates получить список шаблонов проектов Planfix templateId name.`,
    getTemplatesSchema.shape,
    async (params) => runTool("get_project_templates", params, handleGetProjectTemplates),
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
    const toolCount = Object.keys((server as unknown as { _registeredTools?: Record<string, unknown> })._registeredTools ?? {}).length;
    const promptCount = Object.keys((server as unknown as { _registeredPrompts?: Record<string, unknown> })._registeredPrompts ?? {}).length;
    console.error(`[planfix-mcp] v${VERSION} запущен. ${toolCount} инструментов, ${promptCount} навыка. Stdio.`);
  }
}

main().catch((error) => {
  console.error("[planfix-mcp] Ошибка:", error);
  process.exit(1);
});
