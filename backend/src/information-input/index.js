const crypto = require("node:crypto");
const { z } = require("zod");

const CHANNELS = ["news"];
const DEFAULT_PAGE_SIZE = 10;
const CACHE_TTL_MS = 15 * 60 * 1000;
const CONTENT_RETENTION_DAYS = 7;
const MAX_SOURCE_FETCH_CONCURRENCY = 4;

const contentSourceBaseSchema = z.object({
  channel: z.string().min(1).max(40).refine((channel) => CHANNELS.includes(channel), "Invalid content channel"),
  type: z.enum(["rss", "site", "rsshub"]),
  name: z.string().min(1).max(80),
  url: z.string().min(1).max(500),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().positive().optional(),
  parserKey: z.string().max(300).optional().default(""),
});

function withContentSourceRules(schema) {
  return schema.superRefine((value, context) => {
    const rawUrl = String(value.url || "").trim();
    const rawParserKey = String(value.parserKey || "").trim();
    const isHttpUrl = (input) => {
      try {
        const parsed = new URL(input);
        return ["http:", "https:"].includes(parsed.protocol);
      } catch (error) {
        return false;
      }
    };

    if (value.type === "rsshub") {
      if (!rawUrl || (!rawUrl.startsWith("/") && !isHttpUrl(rawUrl))) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["url"],
          message: "RSSHub 路由需填写完整 URL，或以 / 开头的 route",
        });
      }
      if (rawParserKey && !isHttpUrl(rawParserKey)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["parserKey"],
          message: "RSSHub 实例地址需为有效的 http(s) URL",
        });
      }
      return;
    }

    if (!isHttpUrl(rawUrl)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["url"],
        message: "请输入有效的 http(s) URL",
      });
    }
  });
}

const contentSourceSchema = withContentSourceRules(contentSourceBaseSchema);
const contentSourcePatchSchema = contentSourceBaseSchema.partial();

function createInformationInput({ persistence, collector, now = () => new Date(Date.now()) }) {
  const cacheByChannel = new Map();
  const refreshInFlight = new Map();

  function getCache(userId, channel) {
    const key = `${userId}:${channel}`;
    if (!cacheByChannel.has(key)) {
      cacheByChannel.set(key, { items: [], refreshedAt: 0, lastRefreshStats: null });
    }
    return cacheByChannel.get(key);
  }

  function getCacheStatus(userId, channel) {
    const cache = getCache(userId, channel);
    return {
      refreshedAt: cache.refreshedAt || 0,
      isFresh: now().getTime() - (cache.refreshedAt || 0) < CACHE_TTL_MS,
      count: Array.isArray(cache.items) ? cache.items.length : 0,
      lastRefreshStats: cache.lastRefreshStats || null,
    };
  }

  async function listContent(userContext, query) {
    const favoritesOnly = query.favorite === "favorites";
    const filters = {
      channel: query.channel,
      page: query.page || 1,
      pageSize: query.pageSize || DEFAULT_PAGE_SIZE,
      q: query.q || "",
      tag: query.tag || "",
      sourceId: query.sourceId || "",
      sort: query.sort || "latest",
    };
    const [favoriteUrls, result, facets] = await Promise.all([
      favoritesOnly ? Promise.resolve([]) : persistence.listFavoriteUrls(userContext, query.channel),
      favoritesOnly
        ? persistence.listFavoriteItems(userContext, filters)
        : persistence.listItems(userContext, filters),
      favoritesOnly
        ? persistence.listFavoriteFacets(userContext, query.channel)
        : persistence.listItemFacets(userContext, query.channel),
    ]);
    return {
      ...result,
      items: (result.items || []).map((item) => ({
        ...item,
        is_favorite: favoritesOnly || favoriteUrls.includes(item.canonical_url),
      })),
      tags: facets.tags || [],
      sources: facets.sources || [],
      cache: getCacheStatus(userContext.userId, query.channel),
    };
  }

  async function listFeatured(userContext, channel, limit = 3) {
    const [favoriteUrls, items] = await Promise.all([
      persistence.listFavoriteUrls(userContext, channel),
      persistence.listFeaturedItems(userContext, channel, limit),
    ]);
    return {
      items: (items || []).map((item) => ({
        ...item,
        is_favorite: favoriteUrls.includes(item.canonical_url),
      })),
    };
  }

  async function refresh(userContext, { channel, limit }) {
    const cacheKey = `${userContext.userId}:${channel}`;
    if (refreshInFlight.has(cacheKey)) {
      return refreshInFlight.get(cacheKey);
    }

    const job = (async () => {
      const sources = (await persistence.listSources(userContext, channel)).filter((source) => source.enabled);
      if (sources.length === 0) {
        const cache = getCache(userContext.userId, channel);
        cache.items = [];
        cache.refreshedAt = now().getTime();
        await persistence.replaceItems(userContext, channel, []);
        const stats = {
          totalSources: 0,
          successCount: 0,
          failureCount: 0,
          failures: [],
          refreshedAt: now().toISOString(),
        };
        cache.lastRefreshStats = stats;
        return { items: [], stats };
      }

      const results = await mapWithConcurrency(
        sources,
        Math.min(MAX_SOURCE_FETCH_CONCURRENCY, sources.length),
        async (source) => {
          const syncedAt = now().toISOString();
          try {
            const items = dedupeContentItems(await collector.fetchIncrement(source, channel));
            if (items.length) {
              await persistence.upsertItems(userContext, items);
            }
            await persistence.updateSourceSync(userContext, source.id, {
              last_synced_at: syncedAt,
              last_success_at: syncedAt,
              last_error: "",
              latest_published_at: pickLatestPublishedAt(source.latest_published_at, items),
            });
            return { source, ok: true, count: items.length };
          } catch (error) {
            console.warn("[content] failed to refresh source", source.name, error.message);
            await persistence.updateSourceSync(userContext, source.id, {
              last_synced_at: syncedAt,
              last_failure_at: syncedAt,
              last_error: String(error.message || "Unknown error"),
            });
            return { source, ok: false, error };
          }
        },
      );

      const failures = results.filter((result) => !result.ok).map((result) => ({
        sourceId: result.source.id,
        sourceName: result.source.name,
        message: result.error.message,
      }));
      const syncedItemCount = results.reduce(
        (count, result) => count + (result.ok ? Number(result.count || 0) : 0),
        0,
      );
      await persistence.pruneExpiredItems(userContext, {
        channel,
        cutoffIso: getContentRetentionCutoffIso(now),
      });
      const preview = await persistence.listItems(userContext, {
        channel,
        page: 1,
        pageSize: Number.isFinite(Number(limit)) && Number(limit) > 0
          ? Math.max(1, Number(limit))
          : DEFAULT_PAGE_SIZE,
        sort: "latest",
      });
      const items = Array.isArray(preview?.items) ? preview.items : [];
      const stats = {
        totalSources: sources.length,
        successCount: results.length - failures.length,
        failureCount: failures.length,
        failures,
        syncedItemCount,
        latestItemCount: Number(preview?.total || items.length || 0),
        refreshedAt: now().toISOString(),
      };
      const cache = getCache(userContext.userId, channel);
      cache.items = items;
      cache.refreshedAt = now().getTime();
      cache.lastRefreshStats = stats;
      await persistence.touchSyncState(userContext.userId);
      return { items, stats };
    })();

    refreshInFlight.set(cacheKey, job);
    try {
      return await job;
    } finally {
      refreshInFlight.delete(cacheKey);
    }
  }

  async function addFavorite(userContext, item) {
    const timestamp = now().toISOString();
    return persistence.saveFavorite(userContext, {
      ...item,
      favorited_at: timestamp,
      created_at: timestamp,
      updated_at: timestamp,
    });
  }

  async function removeFavorite(userContext, channel, canonicalUrl) {
    return persistence.deleteFavorite(userContext, channel, canonicalUrl);
  }

  function listSources(userContext, channel) {
    return persistence.listSources(userContext, channel);
  }

  async function createSource(userContext, source) {
    const parsed = contentSourceSchema.parse(source);
    const existing = await persistence.listSources(userContext, parsed.channel);
    const timestamp = now().toISOString();
    return persistence.createSource(userContext, {
      id: crypto.randomUUID(),
      channel: parsed.channel,
      type: parsed.type,
      name: parsed.name,
      url: parsed.url,
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : true,
      sort_order: parsed.sortOrder || existing.length + 1,
      parser_key: parsed.parserKey || "",
      created_at: timestamp,
      updated_at: timestamp,
    });
  }

  async function updateSource(userContext, sourceId, source) {
    const parsedPatch = contentSourcePatchSchema.parse(source);
    const current = await persistence.getSource(userContext, sourceId);
    if (!current) return null;

    const parsed = contentSourceSchema.parse({
      channel: parsedPatch.channel ?? current.channel,
      type: parsedPatch.type ?? current.type,
      name: parsedPatch.name ?? current.name,
      url: parsedPatch.url ?? current.url,
      enabled: parsedPatch.enabled ?? current.enabled,
      sortOrder: parsedPatch.sortOrder ?? current.sort_order,
      parserKey: parsedPatch.parserKey ?? current.parser_key ?? "",
    });
    const has = (field) => Object.prototype.hasOwnProperty.call(parsedPatch, field);
    return persistence.updateSource(userContext, sourceId, {
      channel: has("channel") ? parsed.channel : undefined,
      type: has("type") ? parsed.type : undefined,
      name: has("name") ? parsed.name : undefined,
      url: has("url") ? parsed.url : undefined,
      enabled: has("enabled") ? parsed.enabled : undefined,
      sort_order: has("sortOrder") ? parsed.sortOrder : undefined,
      parser_key: has("parserKey") ? parsed.parserKey : undefined,
    });
  }

  function deleteSource(userContext, sourceId) {
    return persistence.deleteSource(userContext, sourceId);
  }

  async function getFullSyncProjection(userContext) {
    await persistence.pruneExpiredItems(userContext, { cutoffIso: getContentRetentionCutoffIso(now) });
    const [sources, items, favorites] = await Promise.all([
      persistence.listSources(userContext),
      persistence.listItemsUpdatedSince(userContext, ""),
      persistence.listFavoriteItemsUpdatedSince(userContext, ""),
    ]);
    return { sources, items, favorites };
  }

  async function getIncrementalSyncProjection(userContext, since) {
    await persistence.pruneExpiredItems(userContext, { cutoffIso: getContentRetentionCutoffIso(now) });
    return Promise.all([
      persistence.listSourcesUpdatedSince(userContext, since),
      persistence.listItemsUpdatedSince(userContext, since),
      persistence.listFavoriteItemsUpdatedSince(userContext, since),
    ]).then(([sources, items, favorites]) => ({ sources, items, favorites }));
  }

  function getSyncState(userId) {
    return persistence.getSyncState(userId);
  }

  return {
    listContent,
    listFeatured,
    refresh,
    addFavorite,
    removeFavorite,
    listSources,
    createSource,
    updateSource,
    deleteSource,
    getFullSyncProjection,
    getIncrementalSyncProjection,
    getSyncState,
    getCacheStatus,
  };
}

function getContentRetentionCutoffIso(now) {
  return new Date(now().getTime() - CONTENT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

function dedupeContentItems(items) {
  const byUrl = new Map();
  for (const item of items || []) {
    const key = `${item.channel}::${item.canonical_url}`;
    const existing = byUrl.get(key);
    if (!existing || new Date(item.published_at || item.fetched_at || 0) > new Date(existing.published_at || existing.fetched_at || 0)) {
      byUrl.set(key, item);
    }
  }
  return [...byUrl.values()].sort((left, right) =>
    new Date(right.published_at || right.fetched_at || 0) - new Date(left.published_at || left.fetched_at || 0),
  );
}

function pickLatestPublishedAt(currentValue, items) {
  return [currentValue, ...(items || []).map((item) => item.published_at || item.fetched_at)]
    .map((value) => {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? "" : date.toISOString();
    })
    .filter(Boolean)
    .sort()
    .at(-1) || "";
}

async function mapWithConcurrency(items, concurrency, iteratee) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await iteratee(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  return results;
}

module.exports = {
  CHANNELS,
  DEFAULT_PAGE_SIZE,
  createInformationInput,
  getContentRetentionCutoffIso,
};
