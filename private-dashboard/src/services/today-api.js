import { fetchJson } from "./api-client";

export function listTasks() {
  return fetchJson("/api/tasks");
}

export function createTask(payload) {
  return fetchJson("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function updateTask(taskId, payload) {
  return fetchJson(`/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function deleteTask(taskId) {
  return fetchJson(`/api/tasks/${taskId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
}

export function fetchDailyRecord(date) {
  return fetchJson(`/api/daily-records/${date}`);
}

export function saveDailyRecord(date, payload) {
  return fetchJson(`/api/daily-records/${date}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function saveAccountPreferences(preferences) {
  return fetchJson("/api/account/preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(preferences),
  });
}
