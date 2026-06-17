import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/client.js", () => ({
  planfixPost: vi.fn(),
  planfixGet: vi.fn(),
}));

import { planfixPost, planfixGet } from "../src/client.js";

const mockPost = vi.mocked(planfixPost);
const mockGet = vi.mocked(planfixGet);
const taskListFields = "id,name,description,status,priority,assignees,participants,auditors,assigner,parent,project,startDateTime,endDateTime,dateTime";
const taskCoreFields = "id,name,status,priority,assignees,assigner,parent,project,startDateTime,endDateTime,dateTime";
const projectFields = "id,name,description,status,owner,group,parent";

describe("tasks tools", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("handleGetTasks calls task/list with defaults", async () => {
    mockPost.mockResolvedValue({ tasks: [] });
    const { handleGetTasks } = await import("../src/tools/tasks.js");
    const result = await handleGetTasks({});
    expect(mockPost).toHaveBeenCalledWith("task/list", {
      offset: 0,
      pageSize: 100,
      fields: taskListFields,
    });
    expect(JSON.parse(result)).toMatchObject({ tasks: [], _meta: { offset: 0, pageSize: 100, returnedCount: 0 } });
  });

  it("handleGetTasks passes filterId", async () => {
    mockPost.mockResolvedValue({ tasks: [{ id: 1 }] });
    const { handleGetTasks } = await import("../src/tools/tasks.js");
    await handleGetTasks({ filterId: 42 });
    expect(mockPost).toHaveBeenCalledWith("task/list", {
      offset: 0,
      pageSize: 100,
      fields: taskListFields,
      filterId: 42,
    });
  });

  it("handleGetTasks passes sort and filters", async () => {
    mockPost.mockResolvedValue({ tasks: [{ id: 1 }] });
    const { handleGetTasks } = await import("../src/tools/tasks.js");
    await handleGetTasks({
      sort: { field: "id", direction: "asc" },
      projectId: 46,
      statusId: [1, 2],
      dateFrom: "2026-01-01",
      dateTo: "2026-06-09",
    });
    expect(mockPost).toHaveBeenCalledWith("task/list", {
      offset: 0,
      pageSize: 100,
      fields: taskListFields,
      filters: [
        { type: 5, operator: "equal", value: 46 },
        { type: 10, operator: "equal", value: "1;2" },
        {
          type: 12,
          operator: "equal",
          value: { dateType: "otherRange", dateFrom: "01-01-2026", dateTo: "09-06-2026" },
        },
      ],
    });
  });

  it("handleGetTask calls GET task/:id", async () => {
    mockGet.mockResolvedValue({ task: { id: 5, name: "Test" } });
    const { handleGetTask } = await import("../src/tools/tasks.js");
    const result = await handleGetTask({ taskId: 5 });
    expect(mockGet).toHaveBeenCalledWith("task/5", { fields: taskCoreFields });
    expect(JSON.parse(result).task.id).toBe(5);
  });

  it("handleGetTask includes description only when requested", async () => {
    mockGet.mockResolvedValue({ task: { id: 5, description: "Long" } });
    const { handleGetTask } = await import("../src/tools/tasks.js");
    await handleGetTask({ taskId: 5, includeDescription: true });
    expect(mockGet).toHaveBeenCalledWith("task/5", { fields: `${taskCoreFields},description` });
  });

  it("handleGetTask can request custom field IDs", async () => {
    mockGet
      .mockResolvedValueOnce({ task: { id: 5, customFieldData: [{ field: { id: 123, name: "Field" }, value: "abc" }] } })
      .mockResolvedValueOnce({ customfields: [{ id: 123, name: "Field", type: 0 }, { id: 456, name: "Empty", type: 0 }] });
    const { handleGetTask } = await import("../src/tools/tasks.js");
    const result = JSON.parse(await handleGetTask({ taskId: 5, customFieldIds: [123, 456] }));
    expect(mockGet).toHaveBeenNthCalledWith(1, "task/5", { fields: `${taskCoreFields},customFieldData,123,456` });
    expect(mockGet).toHaveBeenNthCalledWith(2, "customfield/task", { fields: "id,name,type" });
    expect(result.task.customFieldData).toEqual([
      { fieldId: 123, name: "Field", value: "abc" },
      { fieldId: 456, name: "Empty", value: null },
    ]);
  });

  it("handleGetTask localizes UTC task dates for readable output", async () => {
    mockGet.mockResolvedValue({
      task: {
        id: 5,
        startDateTime: {
          date: "10-06-2026",
          time: "07:00",
          datetime: "2026-06-10T07:00Z",
          dateTimeUtcSeconds: "2026-06-10T07:00:00+0000",
        },
      },
    });
    const { handleGetTask } = await import("../src/tools/tasks.js");
    const result = JSON.parse(await handleGetTask({ taskId: 5 }));
    expect(result.task.startDateTime.date).toBe("10-06-2026");
    expect(result.task.startDateTime.time).toBe("10:00");
  });

  it("handleGetTaskChecklist calls checklist list with fields", async () => {
    mockPost.mockResolvedValue({ items: [] });
    const { handleGetTaskChecklist } = await import("../src/tools/tasks.js");
    const result = await handleGetTaskChecklist({ taskId: 5 });
    expect(mockPost).toHaveBeenCalledWith("task/5/checklist/list", {
      offset: 0,
      pageSize: 100,
      fields: "id,name,isDone,parent,dateTime,assignees",
    });
    expect(JSON.parse(result)).toMatchObject({ items: [], _meta: { returnedCount: 0 } });
  });

  it("handleCreateTask sends correct body", async () => {
    mockPost.mockResolvedValue({ id: 10 });
    const { handleCreateTask } = await import("../src/tools/tasks.js");
    await handleCreateTask({ name: "New task", projectId: 3, assigneeId: 7 });
    expect(mockPost).toHaveBeenCalledWith("task/", {
      name: "New task",
      project: { id: 3 },
      assignees: { users: [{ id: "user:7" }], groups: [] },
    });
  });

  it("handleCreateTask sends template ID", async () => {
    mockPost.mockResolvedValue({ id: 10 });
    const { handleCreateTask } = await import("../src/tools/tasks.js");
    await handleCreateTask({ name: "From template", templateId: 3959 });
    expect(mockPost).toHaveBeenCalledWith("task/", {
      name: "From template",
      template: { id: 3959 },
    });
  });

  it("handleCreateTask accepts prefixed assignee IDs", async () => {
    mockPost.mockResolvedValue({ id: 10 });
    const { handleCreateTask } = await import("../src/tools/tasks.js");
    await handleCreateTask({ name: "New task", assigneeId: "group:3" });
    expect(mockPost).toHaveBeenCalledWith("task/", {
      name: "New task",
      assignees: { users: [], groups: [{ id: 3 }] },
    });
  });

  it("handleCreateTask sends parent, dates, auditors, checklist and custom fields", async () => {
    mockPost
      .mockResolvedValueOnce({ result: "success", id: 100 })
      .mockResolvedValueOnce({ result: "success", id: 201 });
    const { handleCreateTask } = await import("../src/tools/tasks.js");
    const result = await handleCreateTask({
      name: "Structured task",
      parentId: 10,
      startDateTime: "10-06-2026 10:00",
      endDateTime: "2026-06-11T12:00Z",
      assignees: { users: [1, "user:2"], groups: [3] },
      auditors: { users: [4] },
      assignerId: 5,
      checklist: ["Check it"],
      customFieldData: [{ fieldId: 123, value: "abc" }],
    });
    expect(mockPost).toHaveBeenNthCalledWith(1, "task/", {
      name: "Structured task",
      parent: { id: 10 },
      assigner: { id: "user:5" },
      assignees: { users: [{ id: "user:1" }, { id: "user:2" }], groups: [{ id: 3 }] },
      auditors: { users: [{ id: "user:4" }], groups: [] },
      startDateTime: { date: "10-06-2026", time: "10:00" },
      endDateTime: { date: "11-06-2026", time: "12:00" },
      hasStartDate: true,
      hasEndDate: true,
      customFieldData: [{ field: { id: 123 }, value: "abc" }],
    });
    expect(mockPost).toHaveBeenNthCalledWith(2, "task/100/checklist", { name: "Check it" });
    expect(JSON.parse(result).checklist).toEqual([{ result: "success", id: 201 }]);
  });

  it("handleUpdateTask sends correct body", async () => {
    mockPost.mockResolvedValue({ id: 10 });
    const { handleUpdateTask } = await import("../src/tools/tasks.js");
    await handleUpdateTask({ taskId: 10, name: "Updated", status: 2 });
    expect(mockPost).toHaveBeenCalledWith("task/10", {
      name: "Updated",
      status: { id: 2 },
    });
  });

  it("handleUpdateTask normalizes assignee ID", async () => {
    mockPost.mockResolvedValue({ id: 10 });
    const { handleUpdateTask } = await import("../src/tools/tasks.js");
    await handleUpdateTask({ taskId: 10, assigneeId: "user:1" });
    expect(mockPost).toHaveBeenCalledWith("task/10", {
      assignees: { users: [{ id: "user:1" }], groups: [] },
    });
  });

  it("handleCreateTask rejects unsupported date formats", async () => {
    const { handleCreateTask } = await import("../src/tools/tasks.js");
    await expect(handleCreateTask({ name: "Bad date", startDateTime: "tomorrow morning" })).rejects.toThrow(
      "Unsupported Planfix date format",
    );
    expect(mockPost).not.toHaveBeenCalled();
  });
});

describe("contacts tools", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("handleGetContacts calls contact/list", async () => {
    mockPost.mockResolvedValue({ contacts: [] });
    const { handleGetContacts } = await import("../src/tools/contacts.js");
    await handleGetContacts({});
    expect(mockPost).toHaveBeenCalledWith("contact/list", { offset: 0, pageSize: 100 });
  });

  it("handleGetContact calls GET contact/:id", async () => {
    mockGet.mockResolvedValue({ id: 3, name: "John" });
    const { handleGetContact } = await import("../src/tools/contacts.js");
    const result = await handleGetContact({ contactId: 3 });
    expect(mockGet).toHaveBeenCalledWith("contact/3");
    expect(JSON.parse(result).name).toBe("John");
  });
});

describe("projects tools", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("handleGetProjects calls project/list", async () => {
    mockPost.mockResolvedValue({ projects: [] });
    const { handleGetProjects } = await import("../src/tools/projects.js");
    const result = await handleGetProjects({});
    expect(mockPost).toHaveBeenCalledWith("project/list", {
      offset: 0,
      pageSize: 100,
      fields: projectFields,
    });
    expect(JSON.parse(result)).toMatchObject({ projects: [], _meta: { offset: 0, pageSize: 100, returnedCount: 0 } });
  });

  it("handleGetProjects passes sort and filters", async () => {
    mockPost.mockResolvedValue({ projects: [{ id: 46 }] });
    const { handleGetProjects } = await import("../src/tools/projects.js");
    await handleGetProjects({ sort: { field: "name", direction: "asc" }, statusId: [1, 2], groupId: 7, parentId: 46 });
    expect(mockPost).toHaveBeenCalledWith("project/list", {
      offset: 0,
      pageSize: 100,
      fields: projectFields,
      filters: [
        { type: 5006, operator: "equal", value: "1;2" },
        { type: 5002, operator: "equal", value: 7 },
        { type: 5014, operator: "equal", value: 46 },
      ],
    });
  });

  it("handleGetProject calls GET project/:id", async () => {
    mockGet.mockResolvedValue({ id: 1, name: "Proj" });
    const { handleGetProject } = await import("../src/tools/projects.js");
    const result = await handleGetProject({ projectId: 1 });
    expect(mockGet).toHaveBeenCalledWith("project/1", { fields: projectFields });
    expect(JSON.parse(result).name).toBe("Proj");
  });

  it("handleCreateProject sends correct body", async () => {
    mockPost.mockResolvedValue({ result: "success", id: 77 });
    const { handleCreateProject } = await import("../src/tools/projects.js");
    const result = await handleCreateProject({
      name: "Project",
      description: "Desc",
      templateId: 2,
      ownerId: 1,
      parentProjectId: 46,
      groupId: 5,
      assignees: { users: [1], groups: [2] },
      auditors: { users: ["user:3"] },
      clientManagers: { users: [4] },
    });
    expect(mockPost).toHaveBeenCalledWith("project/", {
      name: "Project",
      description: "Desc",
      template: { id: 2 },
      owner: { id: "user:1" },
      parent: { id: 46 },
      group: { id: 5 },
      assignees: { users: [{ id: "user:1" }], groups: [{ id: 2 }] },
      auditors: { users: [{ id: "user:3" }], groups: [] },
      clientManagers: { users: [{ id: "user:4" }], groups: [] },
    });
    expect(JSON.parse(result).id).toBe(77);
  });

  it("handleUpdateProject sends correct body", async () => {
    mockPost.mockResolvedValue({ result: "success" });
    const { handleUpdateProject } = await import("../src/tools/projects.js");
    await handleUpdateProject({ projectId: 77, name: "Updated", status: 2, ownerId: "user:1" });
    expect(mockPost).toHaveBeenCalledWith("project/77", {
      name: "Updated",
      status: { id: 2 },
      owner: { id: "user:1" },
    });
  });
});

describe("comments tools", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("handleGetComments calls task/:id/comments/list with fields", async () => {
    mockPost.mockResolvedValue({ comments: [] });
    const { handleGetComments } = await import("../src/tools/comments.js");
    await handleGetComments({ taskId: 5 });
    expect(mockPost).toHaveBeenCalledWith("task/5/comments/list", {
      offset: 0,
      pageSize: 100,
      fields: "id,description,dateTime,owner,task",
    });
  });

  it("handleAddComment posts to task/:id/comments/", async () => {
    mockPost.mockResolvedValue({ id: 99 });
    const { handleAddComment } = await import("../src/tools/comments.js");
    await handleAddComment({ taskId: 5, body: "Hello" });
    expect(mockPost).toHaveBeenCalledWith("task/5/comments/", { description: "Hello" });
  });
});

describe("relations tools", () => {
  it("linkTasks returns an explicit unsupported error", async () => {
    const { handleLinkTasks } = await import("../src/tools/relations.js");
    const result = JSON.parse(await handleLinkTasks({ taskId: 1, relatedTaskId: 2, type: "successor" }));
    expect(result.result).toBe("fail");
    expect(result.code).toBe("PLANFIX_REST_UNSUPPORTED");
  });
});

describe("statuses tools", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("handleGetStatuses gets statuses for one process", async () => {
    mockGet.mockResolvedValue({ result: "success", statuses: [{ id: 1, name: "New" }] });
    const { handleGetStatuses } = await import("../src/tools/statuses.js");
    await handleGetStatuses({ processId: 7 });
    expect(mockGet).toHaveBeenCalledWith("process/task/7/statuses", { fields: "id,name,color" });
  });

  it("handleGetStatuses gets all process statuses", async () => {
    mockGet
      .mockResolvedValueOnce({ result: "success", processes: [{ id: 7, name: "Default" }] })
      .mockResolvedValueOnce({ result: "success", statuses: [{ id: 1, name: "New" }] });
    const { handleGetStatuses } = await import("../src/tools/statuses.js");
    const result = JSON.parse(await handleGetStatuses({}));
    expect(mockGet).toHaveBeenNthCalledWith(1, "process/task");
    expect(mockGet).toHaveBeenNthCalledWith(2, "process/task/7/statuses", { fields: "id,name,color" });
    expect(result.statusesByProcess).toHaveLength(1);
  });
});

describe("directory tools", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("handleGetTaskCustomFields requests named task custom fields", async () => {
    mockGet.mockResolvedValue({ customfields: [{ id: 1, name: "Field", type: 0, names: { ru: "Поле" }, enumValues: [{ id: 1 }] }] });
    const { handleGetTaskCustomFields } = await import("../src/tools/directories.js");
    const result = JSON.parse(await handleGetTaskCustomFields());
    expect(mockGet).toHaveBeenCalledWith("customfield/task", { fields: "id,name,type" });
    expect(result.customfields[0].name).toBe("Field");
    expect(result.customfields[0].names).toBeUndefined();
    expect(result.count).toBe(1);
  });

  it("handleGetProjectCustomFields requests named project custom fields", async () => {
    mockGet.mockResolvedValue({ customfields: [{ id: 2, name: "Project Field", type: 0 }] });
    const { handleGetProjectCustomFields } = await import("../src/tools/directories.js");
    await handleGetProjectCustomFields();
    expect(mockGet).toHaveBeenCalledWith("customfield/project", { fields: "id,name,type" });
  });

  it("handleGetTaskTemplates requests named task templates", async () => {
    mockGet.mockResolvedValue({ templates: [{ id: 3, name: "Task Template", description: "Long" }] });
    const { handleGetTaskTemplates } = await import("../src/tools/directories.js");
    const result = JSON.parse(await handleGetTaskTemplates({}));
    expect(mockGet).toHaveBeenCalledWith("task/templates", { offset: 0, pageSize: 100, fields: "id,name" });
    expect(result.templates[0]).toEqual({ id: 3, name: "Task Template" });
  });

  it("handleGetProjectTemplates requests named project templates", async () => {
    mockGet.mockResolvedValue({ templates: [{ id: 4, name: "Project Template" }] });
    const { handleGetProjectTemplates } = await import("../src/tools/directories.js");
    await handleGetProjectTemplates({ offset: 10, pageSize: 5 });
    expect(mockGet).toHaveBeenCalledWith("project/templates", { offset: 10, pageSize: 5, fields: "id,name" });
  });
});
