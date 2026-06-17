import { z } from "zod";
import { planfixGet } from "../client.js";

const STATUS_FIELDS = "id,name,color";

export const getStatusesSchema = z.object({
  processId: z.number().optional().describe("ID процесса. Если не задан, вернутся статусы по всем доступным процессам задач."),
});

export async function handleGetStatuses(params: z.infer<typeof getStatusesSchema>): Promise<string> {
  if (params.processId) {
    const statuses = await planfixGet(`process/task/${params.processId}/statuses`, { fields: STATUS_FIELDS });
    return JSON.stringify(statuses, null, 2);
  }

  const processes = await planfixGet("process/task");
  const processItems = processes && typeof processes === "object" && "processes" in processes
    ? (processes as { processes?: Array<{ id?: number }> }).processes ?? []
    : [];
  const statusesByProcess = [];
  for (const process of processItems) {
    if (process.id) {
      statusesByProcess.push({
        process,
        statuses: await planfixGet(`process/task/${process.id}/statuses`, { fields: STATUS_FIELDS }),
      });
    }
  }

  return JSON.stringify({
    result: "success",
    processes: processItems,
    statusesByProcess,
  }, null, 2);
}
