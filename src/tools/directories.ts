import { z } from "zod";
import { planfixGet } from "../client.js";

const CUSTOM_FIELD_FIELDS = "id,name,type";
const TEMPLATE_FIELDS = "id,name";

export const getDirectorySchema = z.object({});

export const getTemplatesSchema = z.object({
  offset: z.number().optional().describe("Смещение для пагинации (по умолчанию 0)"),
  pageSize: z.number().optional().describe("Количество шаблонов на странице (по умолчанию 100)"),
});

function slimCustomFields(result: unknown): unknown {
  if (!result || typeof result !== "object" || Array.isArray(result)) return result;
  const response = result as Record<string, unknown>;
  const customfields = Array.isArray(response.customfields) ? response.customfields : [];
  return {
    result: response.result ?? "success",
    count: customfields.length,
    customfields: customfields.map((field) => {
      if (!field || typeof field !== "object" || Array.isArray(field)) return field;
      const item = field as Record<string, unknown>;
      return {
        id: item.id,
        name: item.name,
        type: item.type,
      };
    }),
  };
}

function slimTemplates(result: unknown): unknown {
  if (!result || typeof result !== "object" || Array.isArray(result)) return result;
  const response = result as Record<string, unknown>;
  const templates = Array.isArray(response.templates) ? response.templates : [];
  return {
    result: response.result ?? "success",
    count: templates.length,
    templates: templates.map((template) => {
      if (!template || typeof template !== "object" || Array.isArray(template)) return template;
      const item = template as Record<string, unknown>;
      return {
        id: item.id,
        name: item.name,
      };
    }),
  };
}

export async function handleGetTaskCustomFields(): Promise<string> {
  const result = await planfixGet("customfield/task", { fields: CUSTOM_FIELD_FIELDS });
  return JSON.stringify(slimCustomFields(result), null, 2);
}

export async function handleGetProjectCustomFields(): Promise<string> {
  const result = await planfixGet("customfield/project", { fields: CUSTOM_FIELD_FIELDS });
  return JSON.stringify(slimCustomFields(result), null, 2);
}

export async function handleGetTaskTemplates(params: z.infer<typeof getTemplatesSchema>): Promise<string> {
  const result = await planfixGet("task/templates", {
    offset: params.offset ?? 0,
    pageSize: params.pageSize ?? 100,
    fields: TEMPLATE_FIELDS,
  });
  return JSON.stringify(slimTemplates(result), null, 2);
}

export async function handleGetProjectTemplates(params: z.infer<typeof getTemplatesSchema>): Promise<string> {
  const result = await planfixGet("project/templates", {
    offset: params.offset ?? 0,
    pageSize: params.pageSize ?? 100,
    fields: TEMPLATE_FIELDS,
  });
  return JSON.stringify(slimTemplates(result), null, 2);
}
