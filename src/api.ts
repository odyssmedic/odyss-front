export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
let csrf = "";
export function clearCsrf() {
  csrf = "";
}
export async function refreshCsrf() {
  const response = await fetch("/api/v1/auth/csrf", {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error("No pudimos preparar la conexión. Intenta nuevamente.");
  const data = await read(response);
  csrf = data.csrf_token;
  return csrf;
}
export async function api<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    key?: string;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const method = options.method || "GET";
  if (method !== "GET" && !csrf) await refreshCsrf();
  async function send() {
    return fetch("/api/v1" + path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      signal: options.signal,
      headers: {
        "Content-Type": "application/json",
        ...(method !== "GET" ? { "X-CSRF-Token": csrf } : {}),
        ...(options.key ? { "Idempotency-Key": options.key } : {}),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  }
  let response: Response;
  try {
    response = await send();
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new Error(
      "No hay conexión con el servidor. Puedes volver a intentar.",
    );
  }
  if (response.status === 204) return undefined as T;
  let data = await read(response);
  if (response.status === 403 && data.error?.code === "csrf_invalid") {
    await refreshCsrf();
    response = await send();
    if (response.status === 204) return undefined as T;
    data = await read(response);
  }
  if (!response.ok) {
    if (
      response.status === 401 &&
      path !== "/auth/login" &&
      path !== "/auth/me"
    )
      window.dispatchEvent(new Event("odyss:expired"));
    throw new ApiError(
      response.status,
      data.error?.code || "request_failed",
      data.error?.message || "No pudimos completar la solicitud.",
    );
  }
  if (data?.csrf_token) csrf = data.csrf_token;
  return data as T;
}
// Catalogs and histories may exceed one API page; load every page explicitly.
export async function all<T>(path: string, signal?: AbortSignal): Promise<T[]> {
  const items: T[] = [];
  for (let offset = 0; ; offset += 200) {
    const data = await api<{ items: T[] }>(
      `${path}${path.includes("?") ? "&" : "?"}limit=200&offset=${offset}`,
      { signal },
    );
    items.push(...data.items);
    if (data.items.length < 200) return items;
  }
}

async function read(response: Response) {
  try {
    return await response.json();
  } catch {
    throw new ApiError(
      response.status,
      "invalid_response",
      "El servidor no está disponible. Intenta nuevamente.",
    );
  }
}
