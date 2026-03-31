import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/client.js", () => ({
  planfixPost: vi.fn(),
  planfixGet: vi.fn(),
}));

import { planfixPost, planfixGet } from "../src/client.js";

const mockPost = vi.mocked(planfixPost);
const mockGet = vi.mocked(planfixGet);

describe("tasks tools", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("handleGetTasks calls task/list with defaults", async () => {
    mockPost.mockResolvedValue({ tasks: [] });
    const { handleGetTasks } = await import("../src/tools/tasks.js");
    const result = await handleGetTasks({});
    expect(mockPost).toHaveBeenCalledWith("task/list", { offset: 0, pageSize: 100 });
    expect(JSON.parse(result)).toEqual({ tasks: [] });
  });

  it("handleGetTasks passes filterId", async () => {
    mockPost.mockResolvedValue({ tasks: [{ id: 1 }] });
    const { handleGetTasks } = await import("../src/tools/tasks.js");
    await handleGetTasks({ filterId: 42 });
    expect(mockPost).toHaveBeenCalledWith("task/list", { offset: 0, pageSize: 100, filterId: 42 });
  });

  it("handleGetTask calls GET task/:id", async () => {
    mockGet.mockResolvedValue({ id: 5, name: "Test" });
    const { handleGetTask } = await import("../src/tools/tasks.js");
    const result = await handleGetTask({ taskId: 5 });
    expect(mockGet).toHaveBeenCalledWith("task/5");
    expect(JSON.parse(result).id).toBe(5);
  });

  it("handleCreateTask sends correct body", async () => {
    mockPost.mockResolvedValue({ id: 10 });
    const { handleCreateTask } = await import("../src/tools/tasks.js");
    await handleCreateTask({ name: "New task", projectId: 3, assigneeId: 7 });
    expect(mockPost).toHaveBeenCalledWith("task/", {
      name: "New task",
      project: { id: 3 },
      assignees: [{ id: 7 }],
    });
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
    await handleGetProjects({});
    expect(mockPost).toHaveBeenCalledWith("project/list", { offset: 0, pageSize: 100 });
  });

  it("handleGetProject calls GET project/:id", async () => {
    mockGet.mockResolvedValue({ id: 1, name: "Proj" });
    const { handleGetProject } = await import("../src/tools/projects.js");
    const result = await handleGetProject({ projectId: 1 });
    expect(mockGet).toHaveBeenCalledWith("project/1");
    expect(JSON.parse(result).name).toBe("Proj");
  });
});

describe("comments tools", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("handleGetComments calls task/:id/comment/list", async () => {
    mockPost.mockResolvedValue({ comments: [] });
    const { handleGetComments } = await import("../src/tools/comments.js");
    await handleGetComments({ taskId: 5 });
    expect(mockPost).toHaveBeenCalledWith("task/5/comment/list", { offset: 0, pageSize: 100 });
  });

  it("handleAddComment posts to task/:id/comment/", async () => {
    mockPost.mockResolvedValue({ id: 99 });
    const { handleAddComment } = await import("../src/tools/comments.js");
    await handleAddComment({ taskId: 5, body: "Hello" });
    expect(mockPost).toHaveBeenCalledWith("task/5/comment/", { description: "Hello" });
  });
});
