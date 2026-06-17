import { z } from "zod";

export const linkTasksSchema = z.object({
  taskId: z.number().describe("ID первой задачи"),
  relatedTaskId: z.number().describe("ID связанной задачи"),
  type: z.enum(["predecessor", "successor", "blocks", "related"]).describe("Тип связи"),
});

export async function handleLinkTasks(params: z.infer<typeof linkTasksSchema>): Promise<string> {
  return JSON.stringify({
    result: "fail",
    code: "PLANFIX_REST_UNSUPPORTED",
    error: "Planfix REST API OpenAPI spec does not expose a task dependency/link endpoint. Cannot create predecessor/successor/blocks/related links via REST safely.",
    requested: params,
  }, null, 2);
}
