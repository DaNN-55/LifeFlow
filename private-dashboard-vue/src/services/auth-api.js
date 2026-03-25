import { fetchJson } from "./api-client";

const AUTH_CHALLENGE_TIMEOUT_MS = 30000;
const CAPTCHA_TIMEOUT_MS = 25000;

export function fetchAuthChallenge(timeoutMs = AUTH_CHALLENGE_TIMEOUT_MS) {
  return fetchJson("/api/auth/challenge", { timeoutMs });
}

export function fetchCaptcha() {
  return fetchJson("/api/auth/captcha", { timeoutMs: CAPTCHA_TIMEOUT_MS });
}

export function signIn(payload) {
  return fetchJson("/api/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function signUp(payload) {
  return fetchJson("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function recoverPassword(payload) {
  return fetchJson("/api/auth/recover-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
