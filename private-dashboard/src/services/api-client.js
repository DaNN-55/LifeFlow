import { API_PROBE_TIMEOUT_MS } from "./config";
import { loadSessionId, resolveApiBase } from "./config";
import { getUserFacingErrorMessage, isLikelyNetworkError } from "../utils/error-message";

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

  let response;
  try {
    response = await fetch(joinApiPath(apiBase, path), {
      ...options,
      headers,
      credentials: options.credentials || "include",
      signal: options.signal || controller.signal,
    });
  } catch (error) {
    const nextError = new Error(getUserFacingErrorMessage(error));
    nextError.status = Number(error?.status || 0);
    nextError.name = error?.name || "Error";
    nextError.cause = error;
    nextError.isNetworkLike = isLikelyNetworkError(error);
    throw nextError;
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  }

  const raw = await response.text();
  let payload = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch (error) {
    if (!response.ok) {
      payload = null;
    } else {
      error.status = response.status;
      error.serverResponse = true;
      error.raw = raw;
      throw error;
    }
  }

  if (!response.ok) {
    const error = new Error(payload?.error || `Request failed: ${response.status}`);
    error.status = response.status;
    error.details = payload?.details || null;
    error.raw = raw;
    error.message = getUserFacingErrorMessage(error, mapStatusFallback(path, response.status));
    throw error;
  }

  return payload;
}

export async function probeHealth() {
  return fetchJson("/health", { timeoutMs: API_PROBE_TIMEOUT_MS });
}

export async function fetchSession() {
  return fetchJson("/api/auth/me", {
    timeoutMs: 10000,
  });
}

function mapStatusFallback(path, status) {
  if (path === "/api/auth/me" && status === 401) {
    return "当前未登录或登录已过期。";
  }
  if (path === "/health") {
    return "后端服务暂时不可用，请稍后重试。";
  }
  return "";
}
