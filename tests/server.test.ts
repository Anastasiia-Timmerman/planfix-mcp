import { describe, it, expect } from "vitest";
import { createPlanfixServer } from "../src/index.js";

describe("createPlanfixServer", () => {
  it("creates a server instance", () => {
    const server = createPlanfixServer();
    expect(server).toBeDefined();
  });
});
