const TIMEOUT = 15_000;
const MAX_RETRIES = 3;

function getBaseUrl(): string {
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
): Promise<unknown> {
  const auth = getAuthHeader();
  const baseUrl = getBaseUrl();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);

    try {
      const options: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: auth,
        },
        signal: controller.signal,
      };
      if (body && method === "POST") {
        options.body = JSON.stringify(body);
      }

      const url = `${baseUrl}/${endpoint}`.replace(/\/+$/, "");
      const response = await fetch(url, options);
      clearTimeout(timer);

      if (response.ok) {
        const text = await response.text();
        return text ? JSON.parse(text) : {};
      }

      if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
        const delay = Math.min(1000 * 2 ** (attempt - 1), 8000);
        console.error(`[planfix-mcp] ${response.status}, повтор через ${delay}мс (${attempt}/${MAX_RETRIES})`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      const errBody = await response.text().catch(() => "");
      throw new Error(`Planfix HTTP ${response.status}: ${response.statusText} ${errBody}`);
    } catch (error) {
      clearTimeout(timer);
      if (error instanceof DOMException && error.name === "AbortError" && attempt < MAX_RETRIES) {
        console.error(`[planfix-mcp] Таймаут, повтор (${attempt}/${MAX_RETRIES})`);
        continue;
      }
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
export async function planfixGet(endpoint: string): Promise<unknown> {
  return planfixRequest("GET", endpoint);
}
