import { DEFAULT_REMOTE_API_BASE } from "../app/constants.js";
import { fetchJson } from "./api-client.js";
import { loadApiBase } from "./config.js";

export function fetchAccountProfile() {
  return fetchJson("/api/account/profile", {
    timeoutMs: 5000,
    apiBase: loadApiBase() || DEFAULT_REMOTE_API_BASE,
  });
}

export function changePassword(currentPassword, newPassword) {
  return fetchJson("/api/account/password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function changeUsername(username, currentPassword) {
  return fetchJson("/api/account/username", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, currentPassword }),
  });
}

export function generateRecoveryCode() {
  return fetchJson("/api/account/recovery-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

export function signOutAccount() {
  return fetchJson("/api/auth/signout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

export function signOutAllAccounts() {
  return fetchJson("/api/account/signout-all", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

export function clearAccountData() {
  return fetchJson("/api/account/clear-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

export function deleteAccount(password) {
  return fetchJson("/api/account/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
}
