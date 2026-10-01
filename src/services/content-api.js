import { fetchJson } from "./api-client.js";

export function refreshContent(channel, limit) {
  const payload = { channel };
  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    payload.limit = limit;
  }
  return fetchJson("/api/content/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    timeoutMs: 60000,
  });
}

export function addContentFavorite(payload) {
  return fetchJson("/api/content/favorites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function removeContentFavorite(channel, canonicalUrl) {
  const search = new URLSearchParams({ channel, canonicalUrl });
  return fetchJson(`/api/content/favorites?${search.toString()}`, {
    method: "DELETE",
  });
}

export function createContentSource(payload) {
  return fetchJson("/api/content-sources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function updateContentSource(sourceId, payload) {
  return fetchJson(`/api/content-sources/${encodeURIComponent(sourceId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function deleteContentSource(sourceId) {
  return fetchJson(`/api/content-sources/${encodeURIComponent(sourceId)}`, {
    method: "DELETE",
  });
}
