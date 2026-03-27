import { fetchJson } from "./api-client";

const LEGACY_NEWS_CHANNELS = ["finance", "science", "ai"];

function shouldFallbackToLegacyNews(channel, error) {
  return String(channel || "").trim() === "news" && Number(error?.status || 0) === 400;
}

function buildContentSearch(params) {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== "" && value !== null && typeof value !== "undefined") {
      search.set(key, String(value));
    }
  });
  return search;
}

function getItemSortTime(item = {}) {
  return new Date(item?.published_at || item?.fetched_at || item?.created_at || 0).getTime();
}

function dedupeByKey(items = [], getKey) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter((item) => {
    const key = String(getKey(item) || "").trim();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function fetchLegacyNewsList(params = {}) {
  const requestedPage = Math.max(1, Number(params.page || 1));
  const requestedPageSize = Math.max(1, Math.min(40, Number(params.pageSize || 10)));
  const perChannelParams = {
    ...params,
    page: 1,
    pageSize: 40,
  };

  const responses = await Promise.all(
    LEGACY_NEWS_CHANNELS.map(async (channel) => {
      const payload = await fetchJson(`/api/content?${buildContentSearch({ ...perChannelParams, channel }).toString()}`);
      return {
        channel,
        payload: payload || {},
      };
    }),
  );

  const mergedItems = dedupeByKey(
    responses.flatMap(({ channel, payload }) =>
      (Array.isArray(payload?.items) ? payload.items : []).map((item) => ({
        ...item,
        channel: item?.channel || channel,
      })),
    ),
    (item) => item?.canonical_url || item?.id,
  ).sort((left, right) => {
    const diff = getItemSortTime(right) - getItemSortTime(left);
    return params.sort === "oldest" ? -diff : diff;
  });

  const start = (requestedPage - 1) * requestedPageSize;
  const mergedSources = dedupeByKey(
    responses.flatMap(({ channel, payload }) =>
      (Array.isArray(payload?.sources) ? payload.sources : []).map((source) => ({
        ...source,
        channel: source?.channel || channel,
      })),
    ),
    (source) => source?.id,
  );
  const mergedTags = [...new Set(
    responses.flatMap(({ payload }) => (Array.isArray(payload?.tags) ? payload.tags : [])),
  )].sort();

  return {
    items: mergedItems.slice(start, start + requestedPageSize),
    total: mergedItems.length,
    page: requestedPage,
    pageSize: requestedPageSize,
    tags: mergedTags,
    sources: mergedSources,
    cache: {
      refreshedAt: "",
      isFresh: false,
      count: mergedItems.length,
      lastRefreshStats: null,
    },
  };
}

export function fetchContentList(params) {
  const search = buildContentSearch(params);
  return fetchJson(`/api/content?${search.toString()}`).catch((error) => {
    if (!shouldFallbackToLegacyNews(params?.channel, error)) {
      throw error;
    }
    return fetchLegacyNewsList(params);
  });
}

export function refreshContent(channel, limit = 30) {
  return fetchJson("/api/content/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel, limit }),
  }).catch(async (error) => {
    if (!shouldFallbackToLegacyNews(channel, error)) {
      throw error;
    }
    const results = await Promise.allSettled(
      LEGACY_NEWS_CHANNELS.map((legacyChannel) =>
        fetchJson("/api/content/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channel: legacyChannel, limit }),
        }),
      ),
    );
    const refreshes = results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);
    return {
      ok: true,
      count: refreshes.reduce((total, payload) => total + Number(payload?.count || 0), 0),
      refresh: {
        totalSources: refreshes.reduce((total, payload) => total + Number(payload?.refresh?.totalSources || 0), 0),
        successCount: refreshes.reduce((total, payload) => total + Number(payload?.refresh?.successCount || 0), 0),
        failureCount: refreshes.reduce((total, payload) => total + Number(payload?.refresh?.failureCount || 0), 0),
        failures: refreshes.flatMap((payload) => payload?.refresh?.failures || []),
        refreshedAt: new Date().toISOString(),
      },
      cache: {
        refreshedAt: new Date().toISOString(),
        isFresh: true,
        count: 0,
        lastRefreshStats: null,
      },
    };
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
  return fetchJson(`/api/content-sources?channel=${encodeURIComponent(channel)}`).catch(async (error) => {
    if (!shouldFallbackToLegacyNews(channel, error)) {
      throw error;
    }
    const responses = await Promise.all(
      LEGACY_NEWS_CHANNELS.map(async (legacyChannel) => ({
        channel: legacyChannel,
        payload: await fetchJson(`/api/content-sources?channel=${encodeURIComponent(legacyChannel)}`).catch(() => ({ sources: [] })),
      })),
    );
    return {
      sources: dedupeByKey(
        responses.flatMap(({ channel: legacyChannel, payload }) =>
          (Array.isArray(payload?.sources) ? payload.sources : []).map((source) => ({
            ...source,
            channel: source?.channel || legacyChannel,
          })),
        ),
        (source) => source?.id,
      ),
    };
  });
}

export function createContentSource(payload) {
  return fetchJson("/api/content-sources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((error) => {
    if (!shouldFallbackToLegacyNews(payload?.channel, error)) {
      throw error;
    }
    return fetchJson("/api/content-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        channel: payload?.legacyChannel || "finance",
      }),
    });
  });
}

export function fetchFeaturedContent(channel, limit = 3) {
  return fetchJson(`/api/content/featured?channel=${encodeURIComponent(channel)}&limit=${encodeURIComponent(limit)}`, {
    timeoutMs: 5000,
  }).catch(async (error) => {
    if (!shouldFallbackToLegacyNews(channel, error)) {
      throw error;
    }
    const responses = await Promise.all(
      LEGACY_NEWS_CHANNELS.map((legacyChannel) =>
        fetchJson(`/api/content/featured?channel=${encodeURIComponent(legacyChannel)}&limit=${encodeURIComponent(limit)}`, {
          timeoutMs: 5000,
        }).catch(() => ({ items: [] })),
      ),
    );
    return {
      items: dedupeByKey(
        responses.flatMap((payload, index) =>
          (Array.isArray(payload?.items) ? payload.items : []).map((item) => ({
            ...item,
            channel: item?.channel || LEGACY_NEWS_CHANNELS[index],
          })),
        ),
        (item) => item?.canonical_url || item?.id,
      )
        .sort((left, right) => getItemSortTime(right) - getItemSortTime(left))
        .slice(0, limit),
    };
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
