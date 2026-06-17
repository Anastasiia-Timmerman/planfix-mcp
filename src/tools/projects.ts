import { z } from "zod";
import { planfixPost, planfixGet } from "../client.js";
import { normalizeCustomFieldData, normalizePeople, normalizePerson } from "./format.js";
import { inferTotal, reverseCollection, withPaginationMeta } from "./listing.js";

const PROJECT_FIELDS = "id,name,description,status,owner,group,parent";
const DEFAULT_PROJECT_SORT = { field: "id", direction: "desc" } as const;

const projectSortSchema = z.union([
  z.enum(["asc", "desc"]),
  z.object({
    field: z.enum(["id", "name"]).optional().describe("Поле сортировки: id или name"),
    direction: z.enum(["asc", "desc"]).optional().describe("Направление сортировки"),
  }),
]).optional();

const projectCustomFieldDataSchema = z.array(z.object({
  fieldId: z.number().describe("Числовой ID кастомного поля"),
  value: z.unknown().describe("Значение поля в формате Planfix"),
}));

const peopleSchema = z.object({
  users: z.array(z.union([z.number(), z.string()])).optional().describe("Пользователи: 1 или user:1/contact:1"),
  groups: z.array(z.union([z.number(), z.string()])).optional().describe("Группы: 5 или group:5"),
});

function applyProjectBodyPeople(
  body: Record<string, unknown>,
  params: {
    assignees?: z.infer<typeof peopleSchema>;
    participants?: z.infer<typeof peopleSchema>;
    auditors?: z.infer<typeof peopleSchema>;
    clientManagers?: z.infer<typeof peopleSchema>;
  },
): void {
  if (params.assignees) body.assignees = normalizePeople(params.assignees);
  if (params.participants) body.participants = normalizePeople(params.participants);
  if (params.auditors) body.auditors = normalizePeople(params.auditors);
  if (params.clientManagers) body.clientManagers = normalizePeople(params.clientManagers);
}

function normalizeProjectSort(sort: z.infer<typeof projectSortSchema>): { field: "id" | "name"; direction: "asc" | "desc" } {
  if (!sort) return { ...DEFAULT_PROJECT_SORT };
  if (typeof sort === "string") return { field: DEFAULT_PROJECT_SORT.field, direction: sort };
  return {
    field: sort.field ?? DEFAULT_PROJECT_SORT.field,
    direction: sort.direction ?? DEFAULT_PROJECT_SORT.direction,
  };
}

function addFilter(filters: Array<Record<string, unknown>>, type: number, operator: string, value: unknown): void {
  if (value !== undefined && value !== null && value !== "") {
    filters.push({ type, operator, value });
  }
}

export const getProjectsSchema = z.object({
  offset: z.number().optional().describe("Смещение для пагинации (по умолчанию 0)"),
  pageSize: z.number().optional().describe("Количество проектов на странице (по умолчанию 100)"),
  filterId: z.number().optional().describe("ID фильтра проектов"),
  sort: projectSortSchema.describe("Сортировка. По умолчанию id desc, чтобы новые проекты были сверху."),
  statusId: z.union([z.number(), z.array(z.number())]).optional().describe("ID статуса проекта или массив ID статусов"),
  groupId: z.number().optional().describe("Фильтр по ID группы проектов"),
  parentId: z.number().optional().describe("Фильтр по ID родительского проекта"),
});

export async function handleGetProjects(params: z.infer<typeof getProjectsSchema>): Promise<string> {
  const offset = params.offset ?? 0;
  const pageSize = params.pageSize ?? 100;
  const sort = normalizeProjectSort(params.sort);
  const filters: Array<Record<string, unknown>> = [];
  addFilter(filters, 5006, "equal", Array.isArray(params.statusId) ? params.statusId.join(";") : params.statusId);
  addFilter(filters, 5002, "equal", params.groupId);
  addFilter(filters, 5014, "equal", params.parentId);

  const fetchPage = (pageOffset: number, requestedPageSize: number) => planfixPost("project/list", {
    offset: pageOffset,
    pageSize: requestedPageSize,
    fields: PROJECT_FIELDS,
    ...(params.filterId ? { filterId: params.filterId } : {}),
    ...(filters.length ? { filters } : {}),
  }) as Promise<Record<string, unknown>>;

  if (sort.direction === "desc") {
    const firstPage = await fetchPage(0, pageSize);
    const total = await inferTotal(fetchPage, "projects", pageSize, firstPage);
    const sourceOffset = Math.max(total - offset - pageSize, 0);
    const result = sourceOffset === 0 && offset === 0 ? firstPage : await fetchPage(sourceOffset, pageSize);
    return JSON.stringify(withPaginationMeta(reverseCollection(result, "projects"), "projects", offset, pageSize, total), null, 2);
  }

  const result = await fetchPage(offset, pageSize);
  return JSON.stringify(withPaginationMeta(result, "projects", offset, pageSize), null, 2);
}

export const getProjectSchema = z.object({
  projectId: z.number().describe("ID проекта"),
});

export async function handleGetProject(params: z.infer<typeof getProjectSchema>): Promise<string> {
  const result = await planfixGet(`project/${params.projectId}`, { fields: PROJECT_FIELDS });
  return JSON.stringify(result, null, 2);
}

export const createProjectSchema = z.object({
  name: z.string().min(1).describe("Название проекта"),
  description: z.string().optional().describe("Описание проекта"),
  templateId: z.number().optional().describe("ID шаблона проекта"),
  ownerId: z.union([z.number(), z.string()]).optional().describe("Владелец проекта: число 1 или user:1"),
  parentProjectId: z.number().optional().describe("ID родительского проекта"),
  groupId: z.number().optional().describe("ID группы проектов"),
  assignees: peopleSchema.optional().describe("Исполнители проекта"),
  participants: peopleSchema.optional().describe("Участники проекта"),
  auditors: peopleSchema.optional().describe("Аудиторы проекта"),
  clientManagers: peopleSchema.optional().describe("Клиентские менеджеры проекта"),
  customFieldData: projectCustomFieldDataSchema.optional().describe("Кастомные поля: [{fieldId, value}]"),
});

export async function handleCreateProject(params: z.infer<typeof createProjectSchema>): Promise<string> {
  const body: Record<string, unknown> = { name: params.name };
  if (params.description) body.description = params.description;
  if (params.templateId) body.template = { id: params.templateId };
  if (params.ownerId) body.owner = normalizePerson(params.ownerId);
  if (params.parentProjectId) body.parent = { id: params.parentProjectId };
  if (params.groupId) body.group = { id: params.groupId };
  applyProjectBodyPeople(body, params);
  const customFieldData = normalizeCustomFieldData(params.customFieldData);
  if (customFieldData) body.customFieldData = customFieldData;

  const result = await planfixPost("project/", body);
  return JSON.stringify(result, null, 2);
}

export const updateProjectSchema = z.object({
  projectId: z.number().describe("ID проекта"),
  name: z.string().optional().describe("Новое название проекта"),
  description: z.string().optional().describe("Новое описание проекта"),
  templateId: z.number().optional().describe("ID шаблона проекта"),
  status: z.number().optional().describe("ID статуса проекта"),
  ownerId: z.union([z.number(), z.string()]).optional().describe("Владелец проекта: число 1 или user:1"),
  parentProjectId: z.number().optional().describe("ID родительского проекта"),
  groupId: z.number().optional().describe("ID группы проектов"),
  assignees: peopleSchema.optional().describe("Исполнители проекта"),
  participants: peopleSchema.optional().describe("Участники проекта"),
  auditors: peopleSchema.optional().describe("Аудиторы проекта"),
  clientManagers: peopleSchema.optional().describe("Клиентские менеджеры проекта"),
  customFieldData: projectCustomFieldDataSchema.optional().describe("Кастомные поля: [{fieldId, value}]"),
});

export async function handleUpdateProject(params: z.infer<typeof updateProjectSchema>): Promise<string> {
  const body: Record<string, unknown> = {};
  if (params.name) body.name = params.name;
  if (params.description) body.description = params.description;
  if (params.templateId) body.template = { id: params.templateId };
  if (params.status) body.status = { id: params.status };
  if (params.ownerId) body.owner = normalizePerson(params.ownerId);
  if (params.parentProjectId) body.parent = { id: params.parentProjectId };
  if (params.groupId) body.group = { id: params.groupId };
  applyProjectBodyPeople(body, params);
  const customFieldData = normalizeCustomFieldData(params.customFieldData);
  if (customFieldData) body.customFieldData = customFieldData;

  const result = await planfixPost(`project/${params.projectId}`, body);
  return JSON.stringify(result, null, 2);
}
