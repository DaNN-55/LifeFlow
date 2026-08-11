import { fetchJson } from "./api-client.js";

function buildContentSearch(params) {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== "" && value !== null && typeof value !== "undefined") {
      search.set(key, String(value));
    }
  });
  return search;
}

export function fetchContentList(params) {
  const search = buildContentSearch(params);
  return fetchJson(`/api/content?${search.toString()}`);
}

export function refreshContent(channel, limit) {
  const payload = { channel };
  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    payload.limit = limit;
  }
  return fetchJson("/api/content/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
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

export function fetchContentSources(channel) {
  return fetchJson(`/api/content-sources?channel=${encodeURIComponent(channel)}`);
}

export function createContentSource(payload) {
  return fetchJson("/api/content-sources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function fetchFeaturedContent(channel, limit = 3) {
  return fetchJson(`/api/content/featured?channel=${encodeURIComponent(channel)}&limit=${encodeURIComponent(limit)}`, {
    timeoutMs: 5000,
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
