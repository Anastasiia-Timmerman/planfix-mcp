import { z } from "zod";
import { planfixPost, planfixGet } from "../client.js";

export const getTasksSchema = z.object({
  offset: z.number().optional().describe("Смещение для пагинации (по умолчанию 0)"),
  pageSize: z.number().optional().describe("Количество задач на странице (по умолчанию 100)"),
  filterId: z.number().optional().describe("ID фильтра задач"),
});

export async function handleGetTasks(params: z.infer<typeof getTasksSchema>): Promise<string> {
  const result = await planfixPost("task/list", {
    offset: params.offset ?? 0,
    pageSize: params.pageSize ?? 100,
    ...(params.filterId ? { filterId: params.filterId } : {}),
  });
  return JSON.stringify(result, null, 2);
}

export const getTaskSchema = z.object({
  taskId: z.number().describe("ID задачи"),
});

export async function handleGetTask(params: z.infer<typeof getTaskSchema>): Promise<string> {
  const result = await planfixGet(`task/${params.taskId}`);
  return JSON.stringify(result, null, 2);
}

export const createTaskSchema = z.object({
  name: z.string().describe("Название задачи"),
  description: z.string().optional().describe("Описание задачи"),
  projectId: z.number().optional().describe("ID проекта"),
  assigneeId: z.number().optional().describe("ID исполнителя"),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional().describe("Приоритет задачи"),
});

export async function handleCreateTask(params: z.infer<typeof createTaskSchema>): Promise<string> {
  const body: Record<string, unknown> = { name: params.name };
  if (params.description) body.description = params.description;
  if (params.projectId) body.project = { id: params.projectId };
  if (params.assigneeId) body.assignees = [{ id: params.assigneeId }];
  if (params.priority) body.priority = params.priority;

  const result = await planfixPost("task/", body);
  return JSON.stringify(result, null, 2);
}

export const updateTaskSchema = z.object({
  taskId: z.number().describe("ID задачи"),
  name: z.string().optional().describe("Новое название"),
  description: z.string().optional().describe("Новое описание"),
  status: z.number().optional().describe("ID нового статуса"),
  assigneeId: z.number().optional().describe("ID нового исполнителя"),
});

export async function handleUpdateTask(params: z.infer<typeof updateTaskSchema>): Promise<string> {
  const body: Record<string, unknown> = {};
  if (params.name) body.name = params.name;
  if (params.description) body.description = params.description;
  if (params.status) body.status = { id: params.status };
  if (params.assigneeId) body.assignees = [{ id: params.assigneeId }];

  const result = await planfixPost(`task/${params.taskId}`, body);
  return JSON.stringify(result, null, 2);
}
