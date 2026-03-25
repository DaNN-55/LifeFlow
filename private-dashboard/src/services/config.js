import {
  AUTH_CONFIG_STORAGE_KEY,
  API_BASE_STORAGE_KEY,
  API_PROBE_TIMEOUT_MS,
  DEFAULT_REMOTE_API_BASE,
  PREVIEW_MODE_STORAGE_KEY,
  SESSION_STORAGE_KEY,
} from "../app/constants";

let resolvedApiBase = "";
let apiBasePromise = null;

function normalizeApiBase(apiBase) {
  return String(apiBase || "").trim().replace(/\/+$/, "");
}

export function loadApiBase() {
  return normalizeApiBase(localStorage.getItem(API_BASE_STORAGE_KEY) || "");
}

export function saveApiBase(apiBase) {
  const normalized = normalizeApiBase(apiBase);
  if (!normalized) {
    localStorage.removeItem(API_BASE_STORAGE_KEY);
    return;
  }
  localStorage.setItem(API_BASE_STORAGE_KEY, normalized);
}

export function resetResolvedApiBase(options = {}) {
  resolvedApiBase = "";
  apiBasePromise = null;
  if (options.clearStorage) {
    localStorage.removeItem(API_BASE_STORAGE_KEY);
  }
}

function loadRuntimeApiBase() {
  if (typeof window === "undefined" || typeof window.LIFEFLOW_API_BASE !== "string") {
    return "";
  }
  return normalizeApiBase(window.LIFEFLOW_API_BASE);
}

function getLocalhostCandidates() {
  if (typeof window === "undefined") {
    return ["http://localhost:8787", "http://127.0.0.1:8787"];
  }

  const { hostname, protocol } = window.location;
  const localBase = hostname && hostname !== "localhost"
    ? "http://localhost:8787"
    : `${protocol}//${hostname || "localhost"}:8787`;

  return [localBase, "http://127.0.0.1:8787"].map(normalizeApiBase);
}

export function listApiBaseCandidates() {
  const fromStorage = loadApiBase();
  const runtimeBase = loadRuntimeApiBase();
  const defaultRemoteBase = normalizeApiBase(DEFAULT_REMOTE_API_BASE);
  const isLocalHost =
    typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const isStoredLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(fromStorage);

  const candidates = (
    isLocalHost
      ? [fromStorage, runtimeBase, ...getLocalhostCandidates(), defaultRemoteBase]
      : [isStoredLocalhost ? "" : fromStorage, runtimeBase, defaultRemoteBase, ...getLocalhostCandidates()]
  )
    .map(normalizeApiBase)
    .filter(Boolean);

  return [...new Set(candidates)];
}

async function probeApiBase(apiBase) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), API_PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(`${apiBase}/health`, {
      credentials: "include",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Healthcheck failed: ${response.status}`);
    }
    return apiBase;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function resolveApiBase() {
  if (resolvedApiBase) {
    return resolvedApiBase;
  }

  if (!apiBasePromise) {
    apiBasePromise = (async () => {
      const defaultRemoteBase = normalizeApiBase(DEFAULT_REMOTE_API_BASE);

      for (const candidate of listApiBaseCandidates()) {
        try {
          resolvedApiBase = await probeApiBase(candidate);
          saveApiBase(resolvedApiBase);
          return resolvedApiBase;
        } catch {
          // Continue probing until one candidate succeeds.
        }
      }

      resolvedApiBase = defaultRemoteBase;
      saveApiBase(resolvedApiBase);
      return resolvedApiBase;
    })().finally(() => {
      apiBasePromise = null;
    });
  }

  return apiBasePromise;
}

export async function refreshApiBase(options = {}) {
  resetResolvedApiBase({ clearStorage: options.clearStorage !== false });
  return resolveApiBase();
}

export function loadAuthConfig() {
  try {
    const raw = localStorage.getItem(AUTH_CONFIG_STORAGE_KEY);
    if (!raw) {
      return { username: "" };
    }
    const parsed = JSON.parse(raw);
    return {
      username: typeof parsed.username === "string" ? parsed.username.trim() : "",
    };
  } catch {
    return { username: "" };
  }
}

export function saveAuthConfig(config = {}) {
  localStorage.setItem(
    AUTH_CONFIG_STORAGE_KEY,
    JSON.stringify({
      username: String(config.username || "").trim(),
    }),
  );
}

export function loadSessionId() {
  return String(localStorage.getItem(SESSION_STORAGE_KEY) || "").trim();
}

export function saveSessionId(sessionId) {
  if (!sessionId) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }
  localStorage.setItem(SESSION_STORAGE_KEY, String(sessionId).trim());
}

export function loadPreviewMode() {
  return localStorage.getItem(PREVIEW_MODE_STORAGE_KEY) === "true";
}

export function savePreviewMode(enabled) {
  if (!enabled) {
    localStorage.removeItem(PREVIEW_MODE_STORAGE_KEY);
    return;
  }
  localStorage.setItem(PREVIEW_MODE_STORAGE_KEY, "true");
}

export { API_PROBE_TIMEOUT_MS, DEFAULT_REMOTE_API_BASE };
