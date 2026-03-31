import { z } from "zod";
import { planfixPost } from "../client.js";

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

export const createTaskSchema = z.object({
  name: z.string().describe("Название задачи"),
  description: z.string().optional().describe("Описание задачи"),
  projectId: z.number().optional().describe("ID проекта"),
  assigneeId: z.number().optional().describe("ID исполнителя"),
});

export async function handleCreateTask(params: z.infer<typeof createTaskSchema>): Promise<string> {
  const body: Record<string, unknown> = {
    name: params.name,
  };
  if (params.description) body.description = params.description;
  if (params.projectId) body.project = { id: params.projectId };
  if (params.assigneeId) body.assignees = [{ id: params.assigneeId }];

  const result = await planfixPost("task/", body);
  return JSON.stringify(result, null, 2);
}
