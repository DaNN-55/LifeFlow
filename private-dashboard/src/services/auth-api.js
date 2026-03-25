import { DEFAULT_REMOTE_API_BASE } from "../app/constants";
import { isLikelyAbortError, isLikelyNetworkError } from "../utils/error-message";
import { fetchJson } from "./api-client";
import { listApiBaseCandidates, saveApiBase } from "./config";

const AUTH_CHALLENGE_TIMEOUT_MS = 55000;
const CAPTCHA_TIMEOUT_MS = 55000;
const LOCAL_AUTH_TIMEOUT_MS = 6000;

function isRetryableAuthDiscoveryError(error) {
  return Number(error?.status || 0) === 404 || isLikelyNetworkError(error) || isLikelyAbortError(error);
}

async function fetchAuthJson(path, options = {}) {
  const defaultRemoteBase = String(DEFAULT_REMOTE_API_BASE || "").trim().replace(/\/+$/, "");
  const candidates = listApiBaseCandidates();
  const orderedCandidates = [
    ...candidates.filter((candidate) => candidate !== defaultRemoteBase),
    defaultRemoteBase,
  ].filter(Boolean);

  let lastError = null;

  for (const candidate of [...new Set(orderedCandidates)]) {
    const timeoutMs = candidate === defaultRemoteBase
      ? Math.max(Number(options.timeoutMs || AUTH_CHALLENGE_TIMEOUT_MS), AUTH_CHALLENGE_TIMEOUT_MS)
      : Math.min(Number(options.timeoutMs || LOCAL_AUTH_TIMEOUT_MS), LOCAL_AUTH_TIMEOUT_MS);

    try {
      const payload = await fetchJson(path, {
        ...options,
        apiBase: candidate,
        timeoutMs,
      });
      saveApiBase(candidate);
      return payload;
    } catch (error) {
      lastError = error;
      if (!isRetryableAuthDiscoveryError(error)) {
        throw error;
      }
    }
  }

  throw lastError || new Error("Auth service unavailable");
}

export function fetchAuthChallenge(timeoutMs = AUTH_CHALLENGE_TIMEOUT_MS) {
  return fetchAuthJson("/api/auth/challenge", { timeoutMs });
}

export function fetchCaptcha() {
  return fetchAuthJson("/api/auth/captcha", { timeoutMs: CAPTCHA_TIMEOUT_MS });
}

export function signIn(payload) {
  return fetchAuthJson("/api/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    timeoutMs: AUTH_CHALLENGE_TIMEOUT_MS,
  });
}

export function signUp(payload) {
  return fetchAuthJson("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    timeoutMs: AUTH_CHALLENGE_TIMEOUT_MS,
  });
}

export function recoverPassword(payload) {
  return fetchAuthJson("/api/auth/recover-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    timeoutMs: AUTH_CHALLENGE_TIMEOUT_MS,
  });
}
