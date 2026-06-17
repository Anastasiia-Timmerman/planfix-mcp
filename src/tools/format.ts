export type PersonId = number | string;

export function normalizePersonId(id: PersonId): string {
  const rawId = typeof id === "number" ? `user:${id}` : id.trim();
  return /^\d+$/.test(rawId) ? `user:${rawId}` : rawId;
}

export function normalizePerson(id: PersonId): { id: string } {
  return { id: normalizePersonId(id) };
}

export function normalizePeople(input: {
  users?: PersonId[];
  groups?: Array<number | string>;
}): { users: Array<{ id: string }>; groups: Array<{ id: number | string }> } {
  return {
    users: (input.users ?? []).map(normalizePerson),
    groups: (input.groups ?? []).map((id) => ({ id })),
  };
}

export function normalizeAssignee(input: PersonId): { users: Array<{ id: string }>; groups: Array<{ id: number | string }> } {
  const id = normalizePersonId(input);
  if (id.startsWith("group:")) {
    return { users: [], groups: [{ id: Number(id.slice("group:".length)) || id }] };
  }
  return { users: [{ id }], groups: [] };
}

export function normalizeTimePoint(value: string | Record<string, unknown>): Record<string, unknown> {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();

  const ruDateTime = /^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})$/.exec(trimmed);
  if (ruDateTime) {
    return { date: `${ruDateTime[1]}-${ruDateTime[2]}-${ruDateTime[3]}`, time: `${ruDateTime[4]}:${ruDateTime[5]}` };
  }

  const isoLikeDateTime = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/.exec(trimmed);
  if (isoLikeDateTime) {
    return { date: `${isoLikeDateTime[3]}-${isoLikeDateTime[2]}-${isoLikeDateTime[1]}`, time: `${isoLikeDateTime[4]}:${isoLikeDateTime[5]}` };
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    return { date: `${match[3]}-${match[2]}-${match[1]}` };
  }

  const ruDate = /^(\d{2})-(\d{2})-(\d{4})$/.exec(trimmed);
  if (ruDate) {
    return { date: trimmed };
  }

  throw new Error(`Unsupported Planfix date format: "${value}". Use "DD-MM-YYYY HH:mm", "YYYY-MM-DD HH:mm", ISO datetime, "YYYY-MM-DD", or "DD-MM-YYYY".`);
}

export function normalizeCustomFieldData(input?: Array<{ fieldId: number; value?: unknown }>): Array<Record<string, unknown>> | undefined {
  return input?.map((item) => ({
    field: { id: item.fieldId },
    value: item.value,
  }));
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function localizePlanfixTimePoint(value: unknown, offsetMinutes = 180): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const timePoint = value as Record<string, unknown>;
  const source = typeof timePoint.dateTimeUtcSeconds === "string"
    ? timePoint.dateTimeUtcSeconds
    : typeof timePoint.datetime === "string"
      ? timePoint.datetime
      : null;
  if (!source) return value;

  const date = new Date(source.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  if (Number.isNaN(date.getTime())) return value;

  const local = new Date(date.getTime() + offsetMinutes * 60_000);
  return {
    ...timePoint,
    date: `${pad(local.getUTCDate())}-${pad(local.getUTCMonth() + 1)}-${local.getUTCFullYear()}`,
    time: `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`,
  };
}

export function localizeTaskDates(task: unknown): unknown {
  if (!task || typeof task !== "object" || Array.isArray(task)) return task;
  const next = { ...(task as Record<string, unknown>) };
  for (const key of ["dateTime", "startDateTime", "endDateTime"]) {
    if (key in next) {
      next[key] = localizePlanfixTimePoint(next[key]);
    }
  }
  if (Array.isArray(next.customFieldData)) {
    next.customFieldData = next.customFieldData.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return item;
      const customField = item as Record<string, unknown>;
      const field = customField.field && typeof customField.field === "object" && !Array.isArray(customField.field)
        ? customField.field as Record<string, unknown>
        : {};
      return {
        fieldId: field.id,
        name: field.name,
        value: customField.value,
      };
    });
  }
  return next;
}

export function localizeTaskResponse(result: unknown): unknown {
  if (!result || typeof result !== "object" || Array.isArray(result)) return result;
  const response = { ...(result as Record<string, unknown>) };
  if (response.task) response.task = localizeTaskDates(response.task);
  if (Array.isArray(response.tasks)) response.tasks = response.tasks.map(localizeTaskDates);
  return response;
}
