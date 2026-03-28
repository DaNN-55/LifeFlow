const crypto = require("node:crypto");
const Parser = require("rss-parser");
const cheerio = require("cheerio");

const parser = new Parser({
  timeout: 8000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
    Accept: "application/rss+xml, application/atom+xml, text/xml, application/xml;q=0.9, text/html;q=0.8, */*;q=0.7",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  },
});

const FETCH_TIMEOUT_MS = 10000;
const DEFAULT_PAGE_SIZE = 10;
const CACHE_TTL_MS = 15 * 60 * 1000;
const DEFAULT_RSSHUB_INSTANCE = "https://rsshub.zhsh.me";
const MAX_SOURCE_FETCH_CONCURRENCY = 4;
const CHANNELS = ["news"];
const cacheByChannel = new Map();
const refreshInFlight = new Map();

function getCacheKey(userId, channel) {
  return `${userId}:${channel}`;
}

function createContentId(channel, canonicalUrl) {
  return crypto
    .createHash("sha1")
    .update(`${channel}:${canonicalUrl}`)
    .digest("hex");
}

function createEmptyChannelCache() {
  return {
    items: [],
    refreshedAt: 0,
    lastRefreshStats: null,
  };
}

function getChannelCache(userId, channel) {
  const key = getCacheKey(userId, channel);
  if (!cacheByChannel.has(key)) {
    cacheByChannel.set(key, createEmptyChannelCache());
  }
  return cacheByChannel.get(key);
}

function setCachedChannelItems(userId, channel, items) {
  const cache = getChannelCache(userId, channel);
  cache.items = items;
  cache.refreshedAt = Date.now();
}

function setChannelRefreshStats(userId, channel, stats) {
  const cache = getChannelCache(userId, channel);
  cache.lastRefreshStats = stats || null;
}

function getChannelCacheStatus(userId, channel) {
  const cache = getChannelCache(userId, channel);
  return {
    refreshedAt: cache.refreshedAt || 0,
    isFresh: Date.now() - (cache.refreshedAt || 0) < CACHE_TTL_MS,
    count: Array.isArray(cache.items) ? cache.items.length : 0,
    lastRefreshStats: cache.lastRefreshStats || null,
  };
}

async function refreshChannelContent({ store, userId, channel, limit }) {
  const cacheKey = getCacheKey(userId, channel);
  if (refreshInFlight.has(cacheKey)) {
    return refreshInFlight.get(cacheKey);
  }

  const job = (async () => {
    const sources = (await store.listContentSources({ userId }, channel)).filter((source) => source.enabled);
    if (sources.length === 0) {
      setCachedChannelItems(userId, channel, []);
      await store.replaceContentItems({ userId }, channel, []);
      const stats = {
        totalSources: 0,
        successCount: 0,
        failureCount: 0,
        failures: [],
        refreshedAt: new Date().toISOString(),
      };
      setChannelRefreshStats(userId, channel, stats);
      return { items: [], stats };
    }
    const failures = [];
    let successCount = 0;
    let syncedItemCount = 0;
    const sourceResults = await mapWithConcurrency(
      sources,
      Math.min(MAX_SOURCE_FETCH_CONCURRENCY, sources.length),
      async (source) => {
        const syncedAt = new Date().toISOString();
        try {
          const items = await fetchSourceIncrement(source, channel);
          const deduped = dedupeContentItems(items);
          if (deduped.length) {
            await store.upsertContentItems({ userId }, deduped);
          }
          await store.updateContentSourceSync?.({ userId }, source.id, {
            last_synced_at: syncedAt,
            last_success_at: syncedAt,
            last_error: "",
            latest_published_at: pickLatestPublishedAt(source.latest_published_at, deduped),
          });
          return { source, ok: true, count: deduped.length };
        } catch (error) {
          console.warn("[content] failed to refresh source", source.name, error.message);
          await store.updateContentSourceSync?.({ userId }, source.id, {
            last_synced_at: syncedAt,
            last_failure_at: syncedAt,
            last_error: String(error.message || "Unknown error"),
          });
          return {
            source,
            ok: false,
            error,
          };
        }
      },
    );

    sourceResults.forEach((result) => {
        if (result.ok) {
          successCount += 1;
          syncedItemCount += Number(result.count || 0);
          return;
        }
      failures.push({
        sourceId: result.source.id,
        sourceName: result.source.name,
        message: result.error.message,
      });
    });

    const previewPageSize = Number.isFinite(Number(limit)) && Number(limit) > 0
      ? Math.max(1, Number(limit))
      : DEFAULT_PAGE_SIZE;
    const preview = await store.listContent(
      { userId },
      {
        channel,
        page: 1,
        pageSize: previewPageSize,
        sort: "latest",
      },
    );
    const latestItems = Array.isArray(preview?.items) ? preview.items : [];
    setCachedChannelItems(userId, channel, latestItems);
    const stats = {
      totalSources: sources.length,
      successCount,
      failureCount: failures.length,
      failures,
      syncedItemCount,
      latestItemCount: Number(preview?.total || latestItems.length || 0),
      refreshedAt: new Date().toISOString(),
    };
    setChannelRefreshStats(userId, channel, stats);
    await store.touchUserSyncState?.(userId);
    return { items: latestItems, stats };
  })();

  refreshInFlight.set(cacheKey, job);
  try {
    return await job;
  } finally {
    refreshInFlight.delete(cacheKey);
  }
}

async function fetchSourceIncrement(source, channel) {
  const stopAtPublishedAt = normalizeDateString(source.latest_published_at || "");
  return source.type === "site"
    ? fetchSiteSource(source, channel, { stopAtPublishedAt })
    : fetchRssSource(source, channel, { stopAtPublishedAt });
}

async function fetchRssSource(source, channel, options = {}) {
  const stopAtPublishedAt = normalizeDateString(options.stopAtPublishedAt || "");
  const feedUrl = resolveSourceFeedUrl(source);
  const xml = await fetchText(feedUrl);
  const feed = await parser.parseString(xml);
  const entries = Array.isArray(feed.items) ? feed.items : [];
  const normalized = [];
  for (const entry of entries) {
    const publishedAt = normalizeDateString(entry?.isoDate || entry?.pubDate || "");
    if (stopAtPublishedAt && publishedAt && publishedAt < stopAtPublishedAt) {
      break;
    }
    const item = await normalizeFeedItem(entry, source, channel);
    if (item?.canonical_url) {
      normalized.push(item);
    }
  }
  return normalized.filter((item) => item && item.canonical_url);
}

async function fetchSiteSource(source, channel, options = {}) {
  const stopAtPublishedAt = normalizeDateString(options.stopAtPublishedAt || "");
  const html = await fetchText(source.url);
  const $ = cheerio.load(html);
  const alternateFeed = $('link[type="application/rss+xml"], link[type="application/atom+xml"]').first().attr("href");
  if (alternateFeed) {
    const feedUrl = new URL(alternateFeed, source.url).toString();
    return fetchRssSource({ ...source, url: feedUrl }, channel, { stopAtPublishedAt });
  }

  const items = [];
  $("article, .article, .post, .story").each((index, element) => {
    const root = $(element);
    const link = root.find("a[href]").first();
    const href = link.attr("href");
    const title = cleanText(link.text()) || cleanText(root.find("h2, h3").first().text());
    if (!href || !title) {
      return;
    }
    const canonicalUrl = new URL(href, source.url).toString();
    const publishedAt = normalizeDateString(
      root.find("time[datetime]").first().attr("datetime") ||
      cleanText(root.find("time").first().text()),
    );
    if (stopAtPublishedAt && publishedAt && publishedAt < stopAtPublishedAt) {
      return false;
    }
    const summaryRaw = cleanText(root.find("p").first().text()) || cleanText(root.text()).slice(0, 240);
    const imageUrl = normalizeUrl(
      root.find("img").first().attr("src") ||
        root.find("img").first().attr("data-src") ||
        root.find("img").first().attr("data-original") ||
        "",
      canonicalUrl,
    );
    items.push({
      title,
      canonicalUrl,
      summaryRaw,
      imageUrl,
      author: "",
      publishedAt,
      tags: [],
      type: "site",
      lang: inferLanguage(title, summaryRaw),
    });
  });
  const normalized = await Promise.all(items.map((item) => normalizeContentItem(item, source, channel)));
  return normalized.filter(Boolean);
}

async function normalizeFeedItem(item, source, channel) {
  const canonicalUrl = String(item.link || item.guid || "").trim();
  const summaryRaw = cleanText(
    item.contentSnippet ||
      item.content ||
      item.summary ||
      item["content:encoded"] ||
      item.description ||
      "",
  );
  return normalizeContentItem(
    {
      title: cleanText(item.title || ""),
      canonicalUrl,
      summaryRaw,
      author: normalizeAuthor(item.creator || item.author || item["dc:creator"] || ""),
      publishedAt: item.isoDate || item.pubDate || "",
      tags: normalizeTags(item.categories || item.category || []),
      type: inferContentType(channel, item),
      lang: inferLanguage(item.title || "", summaryRaw),
      imageUrl: extractFeedItemImage(item, source.url, canonicalUrl),
    },
    source,
    channel,
  );
}

async function normalizeContentItem(item, source, channel) {
  if (!item.title || !item.canonicalUrl) {
    return null;
  }
  const fetchedAt = new Date().toISOString();
  const summaryRaw = String(item.summaryRaw || "").trim();
  const summaryZh = localizeSummary(summaryRaw, item.title);
  const bodyRaw = truncate(summaryRaw || item.title || "", 320);
  const bodyZh = truncate(summaryZh || item.title || "", 320);
  const sourceUrl = resolveSourceDisplayUrl(source);
  const imageUrl = normalizeUrl(item.imageUrl || "", item.canonicalUrl || sourceUrl);
  return {
    id: createContentId(channel, item.canonicalUrl),
    channel,
    source_id: source.id,
    title: item.title,
    summary_zh: summaryZh,
    summary_raw: summaryRaw,
    body_zh: bodyZh,
    body_raw: bodyRaw,
    author: item.author || "",
    published_at: normalizeDateString(item.publishedAt) || fetchedAt,
    content_type: item.type || source.type || "rss",
    source_name: source.name,
    source_url: sourceUrl,
    canonical_url: item.canonicalUrl,
    tags: item.tags || [],
    lang: item.lang || "unknown",
    image_url: imageUrl,
    fetched_at: fetchedAt,
    updated_at: fetchedAt,
    created_at: fetchedAt,
  };
}

function resolveSourceFeedUrl(source = {}) {
  if (source.type !== "rsshub") {
    return String(source.url || "").trim();
  }
  return resolveRsshubUrl(source.url, source.parser_key || "");
}

function resolveSourceDisplayUrl(source = {}) {
  if (source.type !== "rsshub") {
    return String(source.url || "").trim();
  }
  return resolveRsshubUrl(source.url, source.parser_key || "");
}

function resolveRsshubUrl(routeOrUrl = "", instanceUrl = "") {
  const route = String(routeOrUrl || "").trim();
  if (!route) {
    return "";
  }
  if (/^https?:\/\//i.test(route)) {
    return route;
  }
  const instance = normalizeRsshubInstance(instanceUrl || DEFAULT_RSSHUB_INSTANCE);
  const normalizedRoute = route.startsWith("/") ? route : `/${route}`;
  return `${instance}${normalizedRoute}`;
}

function normalizeRsshubInstance(value = "") {
  const raw = String(value || DEFAULT_RSSHUB_INSTANCE).trim() || DEFAULT_RSSHUB_INSTANCE;
  return raw.replace(/\/+$/, "");
}

function dedupeContentItems(items) {
  const map = new Map();
  for (const item of items) {
    const key = `${item.channel}::${item.canonical_url}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
      continue;
    }
    const existingTime = new Date(existing.published_at || existing.fetched_at || 0).getTime();
    const nextTime = new Date(item.published_at || item.fetched_at || 0).getTime();
    if (nextTime > existingTime) {
      map.set(key, item);
    }
  }
  return [...map.values()].sort((left, right) => {
    const leftTime = new Date(left.published_at || left.fetched_at || 0).getTime();
    const rightTime = new Date(right.published_at || right.fetched_at || 0).getTime();
    return rightTime - leftTime;
  });
}

function normalizeTags(tags) {
  const values = Array.isArray(tags) ? tags : [tags];
  return [...new Set(values.map((tag) => normalizePrimaryTag(tag)).filter(Boolean))].slice(0, 8);
}

function normalizePrimaryTag(tag) {
  const cleaned = cleanText(tag);
  if (!cleaned) {
    return "";
  }
  const [primary] = cleaned.split(/\s*\/\s*|\s*>\s*|\s*::\s*/);
  return cleanText(primary);
}

function normalizeAuthor(author) {
  if (Array.isArray(author)) {
    return author.map((item) => cleanText(item)).filter(Boolean).join(", ");
  }
  return cleanText(author);
}

function cleanText(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFeedItemImage(item, sourceUrl, canonicalUrl) {
  const htmlCandidates = [
    item?.["content:encoded"],
    item?.content,
  ];
  const candidates = [
    getImageCandidateFromValue(item?.enclosure),
    getImageCandidateFromValue(item?.image),
    getImageCandidateFromValue(item?.thumbnail),
    getImageCandidateFromValue(item?.["media:thumbnail"]),
    getImageCandidateFromValue(item?.["media:content"]),
    getImageCandidateFromValue(item?.["media:group"]),
    getImageCandidateFromValue(item?.["itunes:image"]),
    ...htmlCandidates.map((value) => extractFirstImageFromHtml(value, canonicalUrl || sourceUrl)),
  ];
  return firstValidImageUrl(candidates, canonicalUrl || sourceUrl);
}

function getImageCandidateFromValue(value) {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = getImageCandidateFromValue(item);
      if (candidate) {
        return candidate;
      }
    }
    return "";
  }
  if (typeof value === "object") {
    const attributes = value.$ || value._attrs || {};
    return (
      value.url ||
      value.href ||
      value.src ||
      value.link ||
      value.image ||
      attributes.url ||
      attributes.href ||
      attributes.src ||
      ""
    );
  }
  return "";
}

function extractFirstImageFromHtml(html, baseUrl) {
  const markup = String(html || "").trim();
  if (!markup || !/<img[\s>]/i.test(markup)) {
    return "";
  }
  const $ = cheerio.load(markup);
  const image = $("img").first();
  return normalizeUrl(
    image.attr("src") || image.attr("data-src") || image.attr("data-original") || "",
    baseUrl,
  );
}

function firstValidImageUrl(candidates, baseUrl) {
  for (const candidate of candidates) {
    const normalized = normalizeUrl(candidate, baseUrl);
    if (normalized) {
      return normalized;
    }
  }
  return "";
}

function normalizeUrl(value, baseUrl) {
  const raw = String(value || "").trim();
  if (!raw || /^data:/i.test(raw)) {
    return "";
  }
  try {
    const normalized = new URL(raw, baseUrl).toString();
    return /\.(?:jpe?g|png|webp|gif|avif|svg)(?:[?#].*)?$/i.test(normalized) ||
      /\/image(?:[/?#]|$)/i.test(normalized) ||
      /\/thumbnail(?:[/?#]|$)/i.test(normalized) ||
      /format=|width=|height=|fit=|crop=/i.test(normalized)
      ? normalized
      : normalized;
  } catch (error) {
    return "";
  }
}

async function resolveContentImageUrl(imageUrl, canonicalUrl, sourceUrl) {
  const directImage = normalizeUrl(imageUrl, canonicalUrl || sourceUrl);
  if (directImage) {
    return directImage;
  }
  return "";
}

function localizeSummary(summaryRaw, title) {
  if (containsChinese(summaryRaw)) {
    return truncate(summaryRaw, 180);
  }
  const fallback = summaryRaw || title;
  if (!fallback) {
    return "暂无摘要。";
  }
  return `英文摘要：${truncate(fallback, 180)}`;
}

function localizeBody(bodyRaw, summaryZh, title) {
  if (containsChinese(bodyRaw)) {
    return truncate(bodyRaw, 320);
  }
  const fallback = bodyRaw || summaryZh || title;
  if (!fallback) {
    return "暂无正文摘录。";
  }
  return `英文正文摘录：${truncate(fallback, 320)}`;
}

function inferLanguage(title, summary) {
  return containsChinese(`${title} ${summary}`) ? "zh" : "en";
}

function containsChinese(text) {
  return /[\u3400-\u9fff]/.test(String(text || ""));
}

function inferContentType(channel, item) {
  const categories = Array.isArray(item.categories) ? item.categories : [];
  const text = `${item.title || ""} ${categories.join(" ")}`.toLowerCase();
  if (channel === "science") {
    if (text.includes("paper") || text.includes("research") || text.includes("journal")) {
      return "论文/研究";
    }
    return "科研资讯";
  }
  if (text.includes("earnings") || text.includes("markets")) {
    return "市场新闻";
  }
  if (channel === "finance") {
    return "财经资讯";
  }
  return "资讯";
}

function truncate(text, length) {
  return text.length > length ? `${text.slice(0, length).trim()}...` : text;
}

function normalizeDateString(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function pickLatestPublishedAt(currentValue, items = []) {
  const candidates = [normalizeDateString(currentValue || "")]
    .concat((items || []).map((item) => normalizeDateString(item?.published_at || item?.fetched_at || "")))
    .filter(Boolean)
    .sort();
  return candidates.at(-1) || "";
}

async function mapWithConcurrency(items, concurrency, iteratee) {
  const queue = Array.isArray(items) ? items : [];
  const workerCount = Math.max(1, Math.min(Number(concurrency || 1), queue.length || 1));
  const results = new Array(queue.length);
  let cursor = 0;

  async function worker() {
    while (cursor < queue.length) {
      const currentIndex = cursor;
      cursor += 1;
      results[currentIndex] = await iteratee(queue[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

async function fetchText(url, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
        Accept:
          "application/rss+xml,application/atom+xml,text/xml,application/xml;q=0.9,text/html,application/xhtml+xml;q=0.8,*/*;q=0.7",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        Referer: "https://www.google.com/",
      },
    });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    return response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = {
  CHANNELS,
  DEFAULT_PAGE_SIZE,
  CACHE_TTL_MS,
  refreshChannelContent,
  getChannelCacheStatus,
  createContentId,
  extractFeedItemImage,
};
