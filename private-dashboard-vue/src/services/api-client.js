import { API_PROBE_TIMEOUT_MS } from "./config";
import { loadSessionId, resolveApiBase } from "./config";

function joinApiPath(baseUrl, path) {
  return `${String(baseUrl || "").replace(/\/+$/, "")}${path}`;
}

export async function fetchJson(path, options = {}) {
  const controller = new AbortController();
  const timeoutMs = Number(options.timeoutMs || API_PROBE_TIMEOUT_MS);
  const timeoutId = timeoutMs ? window.setTimeout(() => controller.abort(), timeoutMs) : 0;
  const apiBase = options.apiBase || await resolveApiBase();
  const headers = new Headers(options.headers || {});
  const sessionId = loadSessionId();

  if (sessionId && !headers.has("x-session-id")) {
    headers.set("x-session-id", sessionId);
  }

  const response = await fetch(joinApiPath(apiBase, path), {
    ...options,
    headers,
    credentials: options.credentials || "include",
    signal: options.signal || controller.signal,
  }).finally(() => {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  });

  const raw = await response.text();
  const payload = raw ? JSON.parse(raw) : null;

  if (!response.ok) {
    const error = new Error(payload?.error || `Request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return payload;
}

export async function probeHealth() {
  return fetchJson("/health", { timeoutMs: API_PROBE_TIMEOUT_MS });
}

export async function fetchSession() {
  return fetchJson("/api/auth/me", {
    timeoutMs: 3500,
  });
}
