import { fetchJson } from "./api-client";

export function fetchSyncBootstrap() {
  return fetchJson("/api/sync/bootstrap");
}

export function fetchSyncChanges(since) {
  const query = new URLSearchParams();
  if (since) {
    query.set("since", String(since));
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return fetchJson(`/api/sync/changes${suffix}`);
}
