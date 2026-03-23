import { fetchJson } from "./api-client";

export function fetchAuthChallenge(timeoutMs = 15000) {
  return fetchJson("/api/auth/challenge", { timeoutMs });
}

export function fetchCaptcha() {
  return fetchJson("/api/auth/captcha", { timeoutMs: 12000 });
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
