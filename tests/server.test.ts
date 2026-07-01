import { describe, it, expect } from "vitest";
import { createPlanfixServer } from "../src/index.js";

describe("createPlanfixServer", () => {
  it("creates a server instance", () => {
    const server = createPlanfixServer();
    expect(server).toBeDefined();
  });

  it("registers get_tasks and the explicit project task list alias", () => {
    const server = createPlanfixServer() as unknown as { _registeredTools: Record<string, unknown> };
    const toolNames = Object.keys(server._registeredTools);

    expect(toolNames).toContain("get_tasks");
    expect(toolNames).toContain("list_project_tasks");
    expect(toolNames).toContain("planfix_update_task");
    expect(toolNames).toContain("planfix_add_comment");
  });
});
