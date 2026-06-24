import { z } from "zod";

export const linkTasksSchema = z.object({
  taskId: z.number().describe("ID задачи-последователя"),
  relatedTaskId: z.number().describe("ID задачи-предшественника"),
  type: z.enum(["FS", "SS", "SF", "FF"]).describe("Тип зависимости: FS, SS, SF или FF"),
  lagDays: z.number().optional().describe("Запаздывание в днях"),
});

export async function handleLinkTasks(params: z.infer<typeof linkTasksSchema>): Promise<string> {
  return JSON.stringify({
    result: "fail",
    code: "PLANFIX_REST_UNSUPPORTED",
    error: "Planfix REST API does not expose a task dependency/link endpoint or dependency fields in task create/update payloads. Checked official OpenAPI and live aromateam Planfix REST API on 2026-06-24.",
    requested: params,
    checked: {
      openApi: "https://help.planfix.com/restapidocs/",
      liveApi: [
        "POST /task/{id}/links/ -> 404",
        "POST /task/{id}/dependencies/ -> 404",
        "POST /task/{id}/predecessors/ -> 404",
        "POST /task/{id}/successors/ -> 404",
        "POST /task/{id}/relations/ -> 404",
        "POST /task/{id} with dependencies/predecessors/links/relations -> 400",
      ],
    },
  }, null, 2);
}
