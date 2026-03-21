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
const ARTICLE_IMAGE_TIMEOUT_MS = 4000;
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_REFRESH_LIMIT = 30;
const CACHE_TTL_MS = 15 * 60 * 1000;
const DEFAULT_RSSHUB_INSTANCE = "https://rsshub.zhsh.me";
const cacheByChannel = new Map();
const refreshInFlight = new Map();
const articleImageCache = new Map();

function createRsshubSource(name, route, instance = "") {
  return {
    name,
    type: "rsshub",
    url: route,
    parser_key: instance,
  };
}

const EXTRA_CHANNEL_CONFIGS = [
  {
    id: "ai",
    defaultSources: [
      createRsshubSource("AI Papers · cs.AI", "/papers/category/arxiv/cs.AI"),
      createRsshubSource("AI Papers · cs.LG", "/papers/category/arxiv/cs.LG"),
      createRsshubSource("AI Papers · cs.CL", "/papers/category/arxiv/cs.CL"),
      createRsshubSource("AI Papers · cs.CV", "/papers/category/arxiv/cs.CV"),
    ],
  },
];

const CHANNEL_CONFIGS = {
  finance: {
    defaultSources: [
      createRsshubSource("华尔街见闻 · 实时快讯（要闻）", "/wallstreetcn/live/global/2"),
      createRsshubSource("华尔街见闻 · 实时快讯（A股）", "/wallstreetcn/live/a-stock/2"),
      createRsshubSource("华尔街见闻 · 最热文章", "/wallstreetcn/hot/day"),
      createRsshubSource("同花顺 · 7×24 要闻（重要,A股）", "/10jqka/realtimenews/重要,A股"),
    ],
  },
  science: {
    defaultSources: [
      createRsshubSource("Nature · Latest Research", "/nature/research/nature"),
      createRsshubSource("Nature · Latest News", "/nature/news"),
      createRsshubSource("Papers · Astrophysics", "/papers/category/arxiv/astro-ph"),
      createRsshubSource("Papers · Physics", "/papers/category/arxiv/physics"),
      createRsshubSource("Papers · Quantitative Biology", "/papers/category/arxiv/q-bio"),
    ],
  },
  ...Object.fromEntries(
    EXTRA_CHANNEL_CONFIGS.map((config) => [
      config.id,
      {
        defaultSources: Array.isArray(config.defaultSources) ? config.defaultSources : [],
      },
    ]),
  ),
};

const CHANNELS = Object.keys(CHANNEL_CONFIGS);
const DEFAULT_SOURCES = Object.fromEntries(
  Object.entries(CHANNEL_CONFIGS).map(([channel, config]) => [channel, config.defaultSources || []]),
);

function getCacheKey(userId, channel) {
  return `${userId}:${channel}`;
}

function createContentId(channel, canonicalUrl) {
  return crypto
    .createHash("sha1")
    .update(`${channel}:${canonicalUrl}`)
    .digest("hex");
}

async function ensureDefaultSources(store, userId, channel) {
  const scope = { userId };
  const existing = await store.listContentSources(scope, channel);
  const defaults = DEFAULT_SOURCES[channel] || [];
  const existingKeys = new Set(
    existing.map((source) => `${String(source.type || "").trim()}::${String(source.url || "").trim()}`),
  );
  for (const [index, source] of defaults.entries()) {
    const dedupeKey = `${String(source.type || "").trim()}::${String(source.url || "").trim()}`;
    if (existingKeys.has(dedupeKey)) {
      continue;
    }
    await store.createContentSource(scope, {
      id: crypto.randomUUID(),
      channel,
      type: source.type,
      name: source.name,
      url: source.url,
      enabled: true,
      sort_order: index + 1,
      parser_key: source.parser_key || "",
      is_default: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    existingKeys.add(dedupeKey);
  }
  return store.listContentSources(scope, channel);
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

function getCachedChannelItems(userId, channel) {
  return getChannelCache(userId, channel).items || [];
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

function clearContentCache(userId, channel = "") {
  if (channel) {
    cacheByChannel.delete(getCacheKey(userId, channel));
    return;
  }
  for (const key of [...cacheByChannel.keys()]) {
    if (key.startsWith(`${userId}:`)) {
      cacheByChannel.delete(key);
    }
  }
}

async function refreshChannelContent({ store, userId, channel, limit = DEFAULT_REFRESH_LIMIT }) {
  const cacheKey = getCacheKey(userId, channel);
  if (refreshInFlight.has(cacheKey)) {
    return refreshInFlight.get(cacheKey);
  }

  const job = (async () => {
    const sources = (await ensureDefaultSources(store, userId, channel)).filter((source) => source.enabled);
    if (sources.length === 0) {
      setCachedChannelItems(userId, channel, []);
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
    const perSourceLimit = Math.max(8, Math.ceil(limit / sources.length) + 4);
    const collected = [];
    const failures = [];
    let successCount = 0;

    for (const source of sources) {
      try {
        const items =
          source.type === "site"
            ? await fetchSiteSource(source, channel, perSourceLimit)
            : await fetchRssSource(source, channel, perSourceLimit);
        collected.push(...items);
        successCount += 1;
      } catch (error) {
        console.warn("[content] failed to refresh source", source.name, error.message);
        failures.push({
          sourceId: source.id,
          sourceName: source.name,
          message: error.message,
        });
      }
    }

    const deduped = dedupeContentItems(collected).slice(0, limit);
    setCachedChannelItems(userId, channel, deduped);
    const stats = {
      totalSources: sources.length,
      successCount,
      failureCount: failures.length,
      failures,
      refreshedAt: new Date().toISOString(),
    };
    setChannelRefreshStats(userId, channel, stats);
    return { items: deduped, stats };
  })();

  refreshInFlight.set(cacheKey, job);
  try {
    return await job;
  } finally {
    refreshInFlight.delete(cacheKey);
  }
}

async function fetchRssSource(source, channel, limit) {
  const feedUrl = resolveSourceFeedUrl(source);
  const xml = await fetchText(feedUrl);
  const feed = await parser.parseString(xml);
  const entries = Array.isArray(feed.items) ? feed.items.slice(0, limit) : [];
  const normalized = await Promise.all(entries.map((item) => normalizeFeedItem(item, source, channel)));
  return normalized.filter((item) => item && item.canonical_url);
}

async function fetchSiteSource(source, channel, limit) {
  const html = await fetchText(source.url);
  const $ = cheerio.load(html);
  const alternateFeed = $('link[type="application/rss+xml"], link[type="application/atom+xml"]').first().attr("href");
  if (alternateFeed) {
    const feedUrl = new URL(alternateFeed, source.url).toString();
    return fetchRssSource({ ...source, url: feedUrl }, channel, limit);
  }

  const items = [];
  $("article, .article, .post, .story").each((index, element) => {
    if (index >= limit) {
      return false;
    }
    const root = $(element);
    const link = root.find("a[href]").first();
    const href = link.attr("href");
    const title = cleanText(link.text()) || cleanText(root.find("h2, h3").first().text());
    if (!href || !title) {
      return;
    }
    const canonicalUrl = new URL(href, source.url).toString();
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
      publishedAt: "",
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
  const imageUrl = await resolveContentImageUrl(item.imageUrl || "", item.canonicalUrl, sourceUrl);
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

function listCachedContent({
  userId,
  channel,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  q = "",
  tag = "",
  sourceId = "",
  sort = "latest",
  favoritesOnly = false,
  favoriteUrls = [],
}) {
  let items = [...getCachedChannelItems(userId, channel)];
  const favoriteUrlSet = new Set((favoriteUrls || []).filter(Boolean));
  const query = String(q || "").trim().toLowerCase();

  items = items.map((item) => ({
    ...item,
    is_favorite: favoriteUrlSet.has(item.canonical_url),
  }));

  if (favoritesOnly) {
    items = items.filter((item) => item.is_favorite);
  }
  if (query) {
    items = items.filter((item) =>
      [item.title, item.summary_zh, item.body_zh, item.source_name, item.author]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }
  if (tag) {
    items = items.filter((item) => Array.isArray(item.tags) && item.tags.includes(tag));
  }
  if (sourceId) {
    items = items.filter((item) => item.source_id === sourceId);
  }
  if (sort === "oldest") {
    items.reverse();
  }
  const total = items.length;
  const safePage = Math.max(1, Number(page || 1));
  const safePageSize = Math.max(1, Math.min(40, Number(pageSize || DEFAULT_PAGE_SIZE)));
  const start = (safePage - 1) * safePageSize;
  return {
    items: items.slice(start, start + safePageSize),
    total,
    page: safePage,
    pageSize: safePageSize,
  };
}

function getCachedContentFacets(userId, channel, sources = [], favoriteUrls = []) {
  const items = getCachedChannelItems(userId, channel);
  const tags = [...new Set(items.flatMap((item) => (Array.isArray(item.tags) ? item.tags : [])))].sort();
  return {
    tags,
    sources: (sources || []).map((source) => ({
      id: source.id,
      name: source.name,
      favoriteCount: items.filter(
        (item) => item.source_id === source.id && favoriteUrls.includes(item.canonical_url),
      ).length,
    })),
  };
}

function getCachedFeaturedContent(userId, channel, limit = 3, favoriteUrls = []) {
  const favoriteSet = new Set((favoriteUrls || []).filter(Boolean));
  return getCachedChannelItems(userId, channel)
    .slice(0, limit)
    .map((item) => ({ ...item, is_favorite: favoriteSet.has(item.canonical_url) }));
}

function getCachedContentItem(userId, itemId, favoriteUrls = []) {
  const favoriteSet = new Set((favoriteUrls || []).filter(Boolean));
  for (const channel of CHANNELS) {
    const match = getCachedChannelItems(userId, channel).find((item) => item.id === itemId);
    if (match) {
      return { ...match, is_favorite: favoriteSet.has(match.canonical_url) };
    }
  }
  return null;
}

function normalizeTags(tags) {
  const values = Array.isArray(tags) ? tags : [tags];
  return [...new Set(values.map((tag) => cleanText(tag)).filter(Boolean))].slice(0, 8);
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
  const articleUrl = normalizeUrl(canonicalUrl, sourceUrl);
  if (!articleUrl) {
    return "";
  }
  return fetchArticleImage(articleUrl);
}

async function fetchArticleImage(articleUrl) {
  if (articleImageCache.has(articleUrl)) {
    return articleImageCache.get(articleUrl);
  }
  const job = (async () => {
    const html = await fetchText(articleUrl, ARTICLE_IMAGE_TIMEOUT_MS);
    const $ = cheerio.load(html);
    const imageCandidates = [
      $("article img").first().attr("src"),
      $("article img").first().attr("data-src"),
      $("article img").first().attr("data-original"),
      $("main article img").first().attr("src"),
      $("main article img").first().attr("data-src"),
      $("main article img").first().attr("data-original"),
      $(".article-content img, .article-body img, .post-content img, .entry-content img, .news-content img, .detail-content img, .content img")
        .first()
        .attr("src"),
      $(".article-content img, .article-body img, .post-content img, .entry-content img, .news-content img, .detail-content img, .content img")
        .first()
        .attr("data-src"),
      $(".article-content img, .article-body img, .post-content img, .entry-content img, .news-content img, .detail-content img, .content img")
        .first()
        .attr("data-original"),
      $("article img").first().attr("src"),
      $("main img").first().attr("src"),
    ];
    return firstValidImageUrl(imageCandidates, articleUrl);
  })().catch(() => "");
  articleImageCache.set(articleUrl, job);
  const resolved = await job;
  articleImageCache.set(articleUrl, Promise.resolve(resolved));
  return resolved;
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
  DEFAULT_REFRESH_LIMIT,
  DEFAULT_SOURCES,
  CACHE_TTL_MS,
  ensureDefaultSources,
  refreshChannelContent,
  listCachedContent,
  getCachedContentFacets,
  getCachedFeaturedContent,
  getCachedContentItem,
  getChannelCacheStatus,
  clearContentCache,
  createContentId,
  extractFeedItemImage,
};
