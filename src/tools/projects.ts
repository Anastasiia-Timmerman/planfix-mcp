import { z } from "zod";
import { planfixPost, planfixGet } from "../client.js";

export const getProjectsSchema = z.object({
  offset: z.number().optional().describe("Смещение для пагинации (по умолчанию 0)"),
  pageSize: z.number().optional().describe("Количество проектов на странице (по умолчанию 100)"),
  filterId: z.number().optional().describe("ID фильтра проектов"),
});

export async function handleGetProjects(params: z.infer<typeof getProjectsSchema>): Promise<string> {
  const result = await planfixPost("project/list", {
    offset: params.offset ?? 0,
    pageSize: params.pageSize ?? 100,
    ...(params.filterId ? { filterId: params.filterId } : {}),
  });
  return JSON.stringify(result, null, 2);
}

export const getProjectSchema = z.object({
  projectId: z.number().describe("ID проекта"),
});

export async function handleGetProject(params: z.infer<typeof getProjectSchema>): Promise<string> {
  const result = await planfixGet(`project/${params.projectId}`);
  return JSON.stringify(result, null, 2);
}
