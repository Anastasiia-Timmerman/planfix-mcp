import { z } from "zod";
import { planfixPost, planfixGet } from "../client.js";
import { localizeTaskResponse, normalizeAssignee, normalizeCustomFieldData, normalizePeople, normalizePerson, normalizeTimePoint } from "./format.js";
import { inferTotal, reverseCollection, withPaginationMeta } from "./listing.js";

const TASK_CORE_FIELDS = "id,name,status,priority,assignees,assigner,parent,project,startDateTime,endDateTime,dateTime";
const TASK_LIST_FIELDS = "id,name,description,status,priority,assignees,participants,auditors,assigner,parent,project,startDateTime,endDateTime,dateTime";
const CHECKLIST_FIELDS = "id,name,isDone,parent,dateTime,assignees";
const DEFAULT_TASK_SORT = { field: "dateCreated", direction: "desc" } as const;

const taskSortSchema = z.union([
  z.enum(["asc", "desc"]),
  z.object({
    field: z.enum(["dateCreated", "id"]).optional().describe("Поле сортировки: dateCreated или id"),
    direction: z.enum(["asc", "desc"]).optional().describe("Направление сортировки"),
  }),
]).optional();

function normalizeTaskSort(sort: z.infer<typeof taskSortSchema>): { field: "dateCreated" | "id"; direction: "asc" | "desc" } {
  if (!sort) return { ...DEFAULT_TASK_SORT };
  if (typeof sort === "string") return { field: DEFAULT_TASK_SORT.field, direction: sort };
  return {
    field: sort.field ?? DEFAULT_TASK_SORT.field,
    direction: sort.direction ?? DEFAULT_TASK_SORT.direction,
  };
}

function buildTaskFields(options?: {
  customFieldIds?: number[];
  includeDescription?: boolean;
  includeParticipants?: boolean;
  includeAuditors?: boolean;
  forList?: boolean;
}): string {
  const fields = new Set((options?.forList ? TASK_LIST_FIELDS : TASK_CORE_FIELDS).split(","));
  if (options?.includeDescription) fields.add("description");
  if (options?.includeParticipants) fields.add("participants");
  if (options?.includeAuditors) fields.add("auditors");
  if (options?.customFieldIds?.length) {
    fields.add("customFieldData");
    for (const fieldId of options.customFieldIds) fields.add(String(fieldId));
  }
  return [...fields].join(",");
}

async function getCustomFieldNameMap(customFieldIds: number[]): Promise<Map<number, string | undefined>> {
  if (!customFieldIds.length) return new Map();
  const result = await planfixGet("customfield/task", { fields: "id,name,type" });
  const fields = result && typeof result === "object" && "customfields" in result
    ? (result as { customfields?: Array<{ id?: number; name?: string }> }).customfields ?? []
    : [];
  return new Map(fields.map((field) => [Number(field.id), field.name]));
}

async function includeRequestedCustomFields(result: unknown, customFieldIds?: number[]): Promise<unknown> {
  if (!customFieldIds?.length || !result || typeof result !== "object" || Array.isArray(result)) return result;
  const response = result as Record<string, unknown>;
  const nameMap = await getCustomFieldNameMap(customFieldIds);

  const enrichTask = (task: unknown): unknown => {
    if (!task || typeof task !== "object" || Array.isArray(task)) return task;
    const next = { ...(task as Record<string, unknown>) };
    const data = Array.isArray(next.customFieldData) ? [...next.customFieldData] : [];
    const present = new Set(data.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return undefined;
      return Number((item as Record<string, unknown>).fieldId);
    }));
    for (const fieldId of customFieldIds) {
      if (!present.has(fieldId)) {
        data.push({ fieldId, name: nameMap.get(fieldId), value: null });
      }
    }
    next.customFieldData = data;
    return next;
  };

  if (response.task) return { ...response, task: enrichTask(response.task) };
  if (Array.isArray(response.tasks)) return { ...response, tasks: response.tasks.map(enrichTask) };
  return response;
}

function addFilter(filters: Array<Record<string, unknown>>, type: number, operator: string, value: unknown): void {
  if (value !== undefined && value !== null && value !== "") {
    filters.push({ type, operator, value });
  }
}

function toPlanfixDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : date;
}

function addDateRangeFilter(
  filters: Array<Record<string, unknown>>,
  type: number,
  dateFrom?: string,
  dateTo?: string,
): void {
  if (!dateFrom && !dateTo) return;
  if (dateFrom && dateTo) {
    addFilter(filters, type, "equal", {
      dateType: "otherRange",
      dateFrom: toPlanfixDate(dateFrom),
      dateTo: toPlanfixDate(dateTo),
    });
    return;
  }
  if (dateFrom) {
    addFilter(filters, type, "gtAndEqual", {
      dateType: "otherDate",
      dateFrom: toPlanfixDate(dateFrom),
    });
  }
  if (dateTo) {
    addFilter(filters, type, "ltAndEqual", {
      dateType: "otherDate",
      dateFrom: toPlanfixDate(dateTo),
    });
  }
}

const peopleSchema = z.object({
  users: z.array(z.union([z.number(), z.string()])).optional().describe("Исполнители/люди: 1 или user:1/contact:1"),
  groups: z.array(z.union([z.number(), z.string()])).optional().describe("Группы: 5 или group:5"),
});

const timePointSchema = z.union([
  z.string(),
  z.record(z.unknown()),
]);

const customFieldDataSchema = z.array(z.object({
  fieldId: z.number().describe("Числовой ID кастомного поля"),
  value: z.unknown().describe("Значение поля в формате Planfix"),
}));

const checklistItemSchema = z.union([
  z.string(),
  z.object({
    name: z.string(),
    assigneeId: z.union([z.number(), z.string()]).optional(),
    assignees: peopleSchema.optional(),
    isDone: z.boolean().optional(),
  }),
]);

function buildTaskBody(params: {
  name?: string;
  description?: string;
  templateId?: number;
  projectId?: number;
  parentId?: number;
  assigneeId?: number | string;
  assignees?: z.infer<typeof peopleSchema>;
  auditors?: z.infer<typeof peopleSchema>;
  assignerId?: number | string;
  startDateTime?: z.infer<typeof timePointSchema>;
  endDateTime?: z.infer<typeof timePointSchema>;
  priority?: "low" | "normal" | "high" | "urgent";
  customFieldData?: z.infer<typeof customFieldDataSchema>;
  status?: number;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (params.name) body.name = params.name;
  if (params.description) body.description = params.description;
  if (params.templateId) body.template = { id: params.templateId };
  if (params.projectId) body.project = { id: params.projectId };
  if (params.parentId) body.parent = { id: params.parentId };
  if (params.assignerId) body.assigner = normalizePerson(params.assignerId);
  if (params.status) body.status = { id: params.status };
  if (params.assignees) body.assignees = normalizePeople(params.assignees);
  else if (params.assigneeId) body.assignees = normalizeAssignee(params.assigneeId);
  if (params.auditors) body.auditors = normalizePeople(params.auditors);
  if (params.startDateTime) body.startDateTime = normalizeTimePoint(params.startDateTime);
  if (params.endDateTime) body.endDateTime = normalizeTimePoint(params.endDateTime);
  if (params.startDateTime) body.hasStartDate = true;
  if (params.endDateTime) body.hasEndDate = true;
  if (params.priority) body.priority = params.priority === "urgent" ? "Urgent" : "NotUrgent";
  const customFieldData = normalizeCustomFieldData(params.customFieldData);
  if (customFieldData) body.customFieldData = customFieldData;
  return body;
}

async function createChecklistItems(taskId: number, checklist: z.infer<typeof checklistItemSchema>[]): Promise<unknown[]> {
  const created: unknown[] = [];
  for (const item of checklist) {
    const body: Record<string, unknown> = typeof item === "string"
      ? { name: item }
      : {
          name: item.name,
          ...(item.isDone !== undefined ? { isDone: item.isDone } : {}),
          ...(item.assignees ? { assignees: normalizePeople(item.assignees) } : {}),
          ...(item.assigneeId ? { assignees: normalizeAssignee(item.assigneeId) } : {}),
        };
    created.push(await planfixPost(`task/${taskId}/checklist`, body));
  }
  return created;
}

export const getTasksSchema = z.object({
  offset: z.number().optional().describe("Смещение для пагинации (по умолчанию 0)"),
  pageSize: z.number().optional().describe("Количество задач на странице (по умолчанию 100)"),
  filterId: z.number().optional().describe("ID фильтра задач"),
  sort: taskSortSchema.describe("Сортировка. По умолчанию dateCreated desc, чтобы свежие задачи были сверху."),
  projectId: z.number().optional().describe("Фильтр задач по ID проекта"),
  statusId: z.union([z.number(), z.array(z.number())]).optional().describe("ID статуса или массив ID статусов"),
  dateFrom: z.string().optional().describe("Дата создания от, формат YYYY-MM-DD"),
  dateTo: z.string().optional().describe("Дата создания до, формат YYYY-MM-DD"),
  customFieldIds: z.array(z.number()).optional().describe("ID кастомных полей, которые нужно вернуть в ответе"),
});

export async function handleGetTasks(params: z.infer<typeof getTasksSchema>): Promise<string> {
  const offset = params.offset ?? 0;
  const pageSize = params.pageSize ?? 100;
  const sort = normalizeTaskSort(params.sort);
  const filters: Array<Record<string, unknown>> = [];
  addFilter(filters, 5, "equal", params.projectId);
  addFilter(filters, 10, "equal", Array.isArray(params.statusId) ? params.statusId.join(";") : params.statusId);
  addDateRangeFilter(filters, 12, params.dateFrom, params.dateTo);

  const fetchPage = (pageOffset: number, requestedPageSize: number) => planfixPost("task/list", {
    offset: pageOffset,
    pageSize: requestedPageSize,
    fields: buildTaskFields({ customFieldIds: params.customFieldIds, forList: true }),
    ...(params.filterId ? { filterId: params.filterId } : {}),
    ...(filters.length ? { filters } : {}),
  }) as Promise<Record<string, unknown>>;

  if (sort.direction === "desc") {
    const firstPage = await fetchPage(0, pageSize);
    const total = await inferTotal(fetchPage, "tasks", pageSize, firstPage);
    const sourceOffset = Math.max(total - offset - pageSize, 0);
    const result = sourceOffset === 0 && offset === 0 ? firstPage : await fetchPage(sourceOffset, pageSize);
    const response = localizeTaskResponse(withPaginationMeta(reverseCollection(result, "tasks"), "tasks", offset, pageSize, total));
    return JSON.stringify(await includeRequestedCustomFields(response, params.customFieldIds), null, 2);
  }

  const result = await fetchPage(offset, pageSize);
  const response = localizeTaskResponse(withPaginationMeta(result, "tasks", offset, pageSize));
  return JSON.stringify(await includeRequestedCustomFields(response, params.customFieldIds), null, 2);
}

export const getTaskSchema = z.object({
  taskId: z.number().describe("ID задачи"),
  customFieldIds: z.array(z.number()).optional().describe("ID кастомных полей, которые нужно вернуть в ответе"),
  includeDescription: z.boolean().optional().describe("Вернуть описание задачи. По умолчанию false, чтобы тяжёлые задачи не зависали."),
  includeParticipants: z.boolean().optional().describe("Вернуть участников задачи. По умолчанию false."),
  includeAuditors: z.boolean().optional().describe("Вернуть аудиторов задачи. По умолчанию false."),
});

export async function handleGetTask(params: z.infer<typeof getTaskSchema>): Promise<string> {
  const result = await planfixGet(`task/${params.taskId}`, {
    fields: buildTaskFields({
      customFieldIds: params.customFieldIds,
      includeDescription: params.includeDescription,
      includeParticipants: params.includeParticipants,
      includeAuditors: params.includeAuditors,
    }),
  });
  const response = localizeTaskResponse(result);
  return JSON.stringify(await includeRequestedCustomFields(response, params.customFieldIds), null, 2);
}

export const getTaskChecklistSchema = z.object({
  taskId: z.number().describe("ID задачи"),
  offset: z.number().optional().describe("Смещение для пагинации (по умолчанию 0)"),
  pageSize: z.number().optional().describe("Количество пунктов на странице (по умолчанию 100)"),
});

export async function handleGetTaskChecklist(params: z.infer<typeof getTaskChecklistSchema>): Promise<string> {
  const offset = params.offset ?? 0;
  const pageSize = params.pageSize ?? 100;
  const result = await planfixPost(`task/${params.taskId}/checklist/list`, {
    offset,
    pageSize,
    fields: CHECKLIST_FIELDS,
  });
  return JSON.stringify(withPaginationMeta(result, "items", offset, pageSize), null, 2);
}

export const createTaskSchema = z.object({
  name: z.string().min(1).describe("Название задачи"),
  description: z.string().optional().describe("Описание задачи"),
  templateId: z.number().optional().describe("ID шаблона задачи"),
  projectId: z.number().optional().describe("ID проекта"),
  parentId: z.number().optional().describe("ID родительской задачи"),
  assigneeId: z.union([z.number(), z.string()]).optional().describe("ID исполнителя: число 1 или строка user:1/group:1"),
  assignees: peopleSchema.optional().describe("Несколько исполнителей и групп"),
  auditors: peopleSchema.optional().describe("Аудиторы"),
  assignerId: z.union([z.number(), z.string()]).optional().describe("Постановщик: число 1 или user:1"),
  startDateTime: timePointSchema.optional().describe("Дата/время начала: YYYY-MM-DD, ISO datetime или TimePoint"),
  endDateTime: timePointSchema.optional().describe("Дедлайн: YYYY-MM-DD, ISO datetime или TimePoint"),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional().describe("Приоритет задачи"),
  checklist: z.array(checklistItemSchema).optional().describe("Пункты чек-листа"),
  customFieldData: customFieldDataSchema.optional().describe("Кастомные поля: [{fieldId, value}]"),
});

export async function handleCreateTask(params: z.infer<typeof createTaskSchema>): Promise<string> {
  const body = buildTaskBody(params);
  const result = await planfixPost("task/", body);
  const taskId = typeof result === "object" && result && "id" in result ? Number((result as { id: unknown }).id) : undefined;
  if (taskId && params.checklist?.length) {
    const checklist = await createChecklistItems(taskId, params.checklist);
    return JSON.stringify({ ...(result as Record<string, unknown>), checklist }, null, 2);
  }
  return JSON.stringify(result, null, 2);
}

export const updateTaskSchema = z.object({
  taskId: z.number().describe("ID задачи"),
  name: z.string().optional().describe("Новое название"),
  description: z.string().optional().describe("Новое описание"),
  templateId: z.number().optional().describe("ID шаблона задачи"),
  status: z.number().optional().describe("ID нового статуса"),
  projectId: z.number().optional().describe("ID проекта"),
  parentId: z.number().optional().describe("ID родительской задачи"),
  assigneeId: z.union([z.number(), z.string()]).optional().describe("ID исполнителя: число 1 или строка user:1/group:1"),
  assignees: peopleSchema.optional().describe("Несколько исполнителей и групп"),
  auditors: peopleSchema.optional().describe("Аудиторы"),
  assignerId: z.union([z.number(), z.string()]).optional().describe("Постановщик: число 1 или user:1"),
  startDateTime: timePointSchema.optional().describe("Дата/время начала: YYYY-MM-DD, ISO datetime или TimePoint"),
  endDateTime: timePointSchema.optional().describe("Дедлайн: YYYY-MM-DD, ISO datetime или TimePoint"),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional().describe("Приоритет задачи"),
  customFieldData: customFieldDataSchema.optional().describe("Кастомные поля: [{fieldId, value}]"),
});

export async function handleUpdateTask(params: z.infer<typeof updateTaskSchema>): Promise<string> {
  const body = buildTaskBody(params);
  const result = await planfixPost(`task/${params.taskId}`, body);
  return JSON.stringify(result, null, 2);
}
