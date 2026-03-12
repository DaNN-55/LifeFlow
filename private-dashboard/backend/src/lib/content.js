const crypto = require("node:crypto");
const Parser = require("rss-parser");
const cheerio = require("cheerio");

const parser = new Parser({
  timeout: 8000,
  headers: {
    "User-Agent": "LifeFlow/1.0 (+https://life-flow-seven.vercel.app)",
    Accept: "application/rss+xml, application/atom+xml, text/xml, application/xml, text/html",
  },
});

const CHANNELS = ["finance", "science"];
const FETCH_TIMEOUT_MS = 10000;
const DEFAULT_PAGE_SIZE = 30;
const DEFAULT_REFRESH_LIMIT = 36;
const CACHE_TTL_MS = 15 * 60 * 1000;
const cacheByChannel = new Map();
const refreshInFlight = new Map();

const DEFAULT_SOURCES = {
  finance: [
    { name: "Reuters Markets", type: "rss", url: "https://feeds.reuters.com/reuters/marketsNews" },
    { name: "CNBC Top News", type: "rss", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html" },
    { name: "Yahoo Finance", type: "rss", url: "https://finance.yahoo.com/news/rssindex" },
  ],
  science: [
    { name: "Nature", type: "rss", url: "https://www.nature.com/nature.rss" },
    { name: "ScienceDaily", type: "rss", url: "https://www.sciencedaily.com/rss/top/science.xml" },
    { name: "Phys.org", type: "rss", url: "https://phys.org/rss-feed/" },
  ],
};

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
  if (existing.length > 0) {
    return existing;
  }
  const defaults = DEFAULT_SOURCES[channel] || [];
  for (const [index, source] of defaults.entries()) {
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
  }
  return store.listContentSources(scope, channel);
}

function createEmptyChannelCache() {
  return {
    items: [],
    refreshedAt: 0,
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

function getChannelCacheStatus(userId, channel) {
  const cache = getChannelCache(userId, channel);
  return {
    refreshedAt: cache.refreshedAt || 0,
    isFresh: Date.now() - (cache.refreshedAt || 0) < CACHE_TTL_MS,
    count: Array.isArray(cache.items) ? cache.items.length : 0,
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
      return [];
    }
    const perSourceLimit = Math.max(8, Math.ceil(limit / sources.length) + 4);
    const collected = [];

    for (const source of sources) {
      try {
        const items =
          source.type === "site"
            ? await fetchSiteSource(source, channel, perSourceLimit)
            : await fetchRssSource(source, channel, perSourceLimit);
        collected.push(...items);
      } catch (error) {
        console.warn("[content] failed to refresh source", source.name, error.message);
      }
    }

    const deduped = dedupeContentItems(collected).slice(0, limit);
    setCachedChannelItems(userId, channel, deduped);
    return deduped;
  })();

  refreshInFlight.set(cacheKey, job);
  try {
    return await job;
  } finally {
    refreshInFlight.delete(cacheKey);
  }
}

async function fetchRssSource(source, channel, limit) {
  const feed = await parser.parseURL(source.url);
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
    items.push({
      title,
      canonicalUrl,
      summaryRaw,
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
  const excerpt = await buildBodyExcerpt(item.canonicalUrl, summaryRaw, item.title);
  const bodyRaw = excerpt.raw || summaryRaw;
  const bodyZh = localizeBody(bodyRaw, summaryZh, item.title);
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
    source_url: source.url,
    canonical_url: item.canonicalUrl,
    tags: item.tags || [],
    lang: item.lang || "unknown",
    image_url: "",
    fetched_at: fetchedAt,
    updated_at: fetchedAt,
    created_at: fetchedAt,
  };
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
    return truncate(bodyRaw, 2200);
  }
  const fallback = bodyRaw || summaryZh || title;
  if (!fallback) {
    return "暂无正文摘录。";
  }
  return `英文正文摘录：${truncate(fallback, 2200)}`;
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
  return "财经资讯";
}

function truncate(text, length) {
  return text.length > length ? `${text.slice(0, length).trim()}...` : text;
}

function normalizeDateString(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "LifeFlow/1.0 (+https://life-flow-seven.vercel.app)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
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

async function buildBodyExcerpt(url, summaryRaw, title) {
  const baseText = cleanText(summaryRaw || title || "");
  if (baseText.length >= 260) {
    return { raw: truncate(baseText, 2200) };
  }
  try {
    const html = await fetchText(url);
    const $ = cheerio.load(html);
    $("script, style, noscript, header, footer, nav, aside").remove();
    const candidate = [
      cleanText($("article").text()),
      cleanText($("main").text()),
      cleanText($(".article-body, .entry-content, .post-content, .story-body").text()),
      cleanText($("body").text()),
    ].find((text) => text && text.length >= 220);
    return { raw: truncate(candidate || baseText, 2200) };
  } catch (error) {
    return { raw: truncate(baseText, 2200) };
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
};
