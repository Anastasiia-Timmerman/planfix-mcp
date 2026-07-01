import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("planfixRequest", () => {
  const origApiKey = process.env.PLANFIX_API_KEY;
  const origToken = process.env.PLANFIX_TOKEN;
  const origAccount = process.env.PLANFIX_ACCOUNT;

  beforeEach(() => {
    vi.resetModules();
    process.env.PLANFIX_API_KEY = "test-api-key";
    process.env.PLANFIX_ACCOUNT = "testaccount";
    delete process.env.PLANFIX_TOKEN;
  });

  afterEach(() => {
    if (origApiKey !== undefined) process.env.PLANFIX_API_KEY = origApiKey; else delete process.env.PLANFIX_API_KEY;
    if (origToken !== undefined) process.env.PLANFIX_TOKEN = origToken; else delete process.env.PLANFIX_TOKEN;
    if (origAccount !== undefined) process.env.PLANFIX_ACCOUNT = origAccount; else delete process.env.PLANFIX_ACCOUNT;
    vi.restoreAllMocks();
  });

  it("throws when no auth env is set", async () => {
    delete process.env.PLANFIX_API_KEY;
    delete process.env.PLANFIX_TOKEN;

    const { planfixRequest } = await import("../src/client.js");
    await expect(planfixRequest("GET", "task/1")).rejects.toThrow("Не задан ключ авторизации");
  });

  it("uses PLANFIX_ACCOUNT for base URL", async () => {
    const mockResponse = new Response(JSON.stringify({ id: 1 }), { status: 200 });
    const fetchMock = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal("fetch", fetchMock);

    const { planfixRequest } = await import("../src/client.js");
    await planfixRequest("GET", "task/1");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("testaccount.planfix.com/rest/task/1"),
      expect.any(Object),
    );
  });

  it("sends Authorization header with Bearer token", async () => {
    const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
    const fetchMock = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal("fetch", fetchMock);

    const { planfixRequest } = await import("../src/client.js");
    await planfixRequest("POST", "task/list", { offset: 0 });

    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[1].headers.Authorization).toBe("Bearer test-api-key");
    expect(callArgs[1].method).toBe("POST");
  });

  it("falls back to PLANFIX_TOKEN if PLANFIX_API_KEY not set", async () => {
    delete process.env.PLANFIX_API_KEY;
    process.env.PLANFIX_TOKEN = "legacy-token";

    const mockResponse = new Response(JSON.stringify({}), { status: 200 });
    const fetchMock = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal("fetch", fetchMock);

    const { planfixRequest } = await import("../src/client.js");
    await planfixRequest("GET", "task/1");

    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[1].headers.Authorization).toBe("Bearer legacy-token");
  });

  it("throws on non-retryable HTTP errors", async () => {
    const mockResponse = new Response("Forbidden", { status: 403, statusText: "Forbidden" });
    const fetchMock = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal("fetch", fetchMock);

    const { planfixRequest } = await import("../src/client.js");
    await expect(planfixRequest("GET", "task/1")).rejects.toThrow("Planfix HTTP 403");
  });

  it("throws a clear timeout error", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { planfixRequest } = await import("../src/client.js");
    const request = expect(planfixRequest("POST", "task/", { name: "Slow" })).rejects.toThrow(
      "Planfix request timed out after 30000ms: POST task/",
    );
    await vi.advanceTimersByTimeAsync(30_000);
    await request;
    vi.useRealTimers();
  });

  it("times out even if fetch ignores abort", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(() => new Promise(() => undefined));
    vi.stubGlobal("fetch", fetchMock);

    const { planfixRequest } = await import("../src/client.js");
    const request = expect(planfixRequest("POST", "project/", { name: "Slow" })).rejects.toThrow(
      "Planfix request timed out after 30000ms: POST project/",
    );
    await vi.advanceTimersByTimeAsync(30_000);
    await request;
    vi.useRealTimers();
  });

  it("times out if response body never finishes", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => new Promise(() => undefined),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { planfixRequest } = await import("../src/client.js");
    const request = expect(planfixRequest("POST", "project/77", { parent: { id: 46 } })).rejects.toThrow(
      "Planfix request timed out after 30000ms: POST project/77",
    );
    await vi.advanceTimersByTimeAsync(30_000);
    await request;
    vi.useRealTimers();
  });
});
