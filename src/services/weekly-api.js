import { fetchJson } from "./api-client.js";
import { fetchDailyRecord, listTasks } from "./today-api.js";

export function fetchWeeklyReview(week) {
  return fetchJson(`/api/weekly-review/${week}`);
}

export function fetchWeeklySummary(week) {
  return fetchJson(`/api/weekly-summaries/${week}`);
}

export function fetchTaskTimeline() {
  return fetchJson("/api/task-timeline");
}

export function saveWeeklySummary(week, content) {
  return fetchJson(`/api/weekly-summaries/${week}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

export { fetchDailyRecord, listTasks };
