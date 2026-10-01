import { fetchJson } from "./api-client.js";

export function deleteWeeklySummary(week) {
  return fetchJson(`/api/weekly-summaries/${encodeURIComponent(week)}`, { method: "DELETE" });
}

export function fetchWeeklySummary(week) {
  return fetchJson(`/api/weekly-summaries/${week}`);
}

export function saveWeeklySummary(week, content) {
  return fetchJson(`/api/weekly-summaries/${week}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}
