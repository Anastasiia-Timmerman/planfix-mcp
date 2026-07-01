const TIMEOUT = 30_000;
const MAX_RETRIES = 3;

class PlanfixTimeoutError extends Error {
  constructor(method: string, endpoint: string) {
    super(`Planfix request timed out after ${TIMEOUT}ms: ${method} ${endpoint}`);
    this.name = "PlanfixTimeoutError";
  }
}

function getBaseUrl(): string {
  const explicitBaseUrl = process.env.PLANFIX_BASE_URL;
  if (explicitBaseUrl) {
    return explicitBaseUrl.replace(/\/+$/, "");
  }

  const account = process.env.PLANFIX_ACCOUNT;
  if (account) {
    return `https://${account}.planfix.com/rest`;
  }
  return "https://api.planfix.com/rest";
}

function getAuthHeader(): string {
  const apiKey = process.env.PLANFIX_API_KEY;
  if (apiKey) return `Bearer ${apiKey}`;

  const token = process.env.PLANFIX_TOKEN;
  if (token) return `Bearer ${token}`;

  throw new Error(
    "Не задан ключ авторизации. Установите PLANFIX_API_KEY (или PLANFIX_TOKEN). " +
    "Опционально — PLANFIX_ACCOUNT (субдомен).",
  );
}

export async function planfixRequest(
  method: "GET" | "POST",
  endpoint: string,
  body?: Record<string, unknown>,
  query?: Record<string, string | number | boolean | undefined>,
): Promise<unknown> {
  const auth = getAuthHeader();
  const baseUrl = getBaseUrl();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    let timer: NodeJS.Timeout | undefined;

    try {
      const options: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
          Connection: "close",
          Authorization: auth,
        },
        signal: controller.signal,
      };
      if (body && method === "POST") {
        options.body = JSON.stringify(body);
      }

      const url = new URL(`${baseUrl}/${endpoint}`.replace(/\/+$/, ""));
      if (query) {
        for (const [key, value] of Object.entries(query)) {
          if (value !== undefined) {
            url.searchParams.set(key, String(value));
          }
        }
      }
      const started = Date.now();
      console.error(`[planfix-mcp] HTTP ${method} ${endpoint} attempt ${attempt} start`);
      const requestPromise = (async () => {
        const response = await fetch(url.toString(), options);
        const duration = Date.now() - started;
        console.error(`[planfix-mcp] HTTP ${method} ${endpoint} attempt ${attempt} -> ${response.status} ${duration}ms`);

        if (response.ok) {
          const text = await response.text();
          return text ? JSON.parse(text) : {};
        }

        if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
          const delay = Math.min(1000 * 2 ** (attempt - 1), 8000);
          console.error(`[planfix-mcp] ${response.status}, повтор через ${delay}мс (${attempt}/${MAX_RETRIES})`);
          await response.text().catch(() => "");
          await new Promise((r) => setTimeout(r, delay));
          return Symbol.for("planfix.retry");
        }

        const errBody = await response.text().catch(() => "");
        throw new Error(`Planfix HTTP ${response.status}: ${response.statusText} ${errBody}`);
      })();
      requestPromise.catch(() => undefined);
      const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new PlanfixTimeoutError(method, endpoint));
        }, TIMEOUT);
      });
      const result = await Promise.race([requestPromise, timeoutPromise]);
      if (timer) clearTimeout(timer);
      if (result === Symbol.for("planfix.retry")) {
        continue;
      }
      return result;
    } catch (error) {
      if (timer) clearTimeout(timer);
      if (error instanceof PlanfixTimeoutError) {
        console.error(`[planfix-mcp] HTTP ${method} ${endpoint} timeout`);
        throw error;
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        console.error(`[planfix-mcp] HTTP ${method} ${endpoint} aborted by timeout`);
        throw new PlanfixTimeoutError(method, endpoint);
      }
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[planfix-mcp] HTTP ${method} ${endpoint} error: ${message}`);
      throw error;
    }
  }
  throw new Error("Planfix API: все попытки исчерпаны");
}

/** POST shorthand (backward compat) */
export async function planfixPost(endpoint: string, body: Record<string, unknown> = {}): Promise<unknown> {
  return planfixRequest("POST", endpoint, body);
}

/** GET shorthand */
export async function planfixGet(
  endpoint: string,
  query?: Record<string, string | number | boolean | undefined>,
): Promise<unknown> {
  return planfixRequest("GET", endpoint, undefined, query);
}
