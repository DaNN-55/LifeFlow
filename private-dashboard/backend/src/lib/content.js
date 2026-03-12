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
const REFRESH_INTERVAL_MS = 20 * 60 * 1000;
const REFRESH_CACHE_TTL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10000;
const DEFAULT_PAGE_SIZE = 10;
const refreshState = new Map();
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

async function refreshChannelContent({ store, userId, channel, limit = DEFAULT_PAGE_SIZE }) {
  return runRefresh({ store, userId, channel, limit, force: true });
}

async function ensureFreshChannelContent({ store, userId, channel, limit = DEFAULT_PAGE_SIZE, force = false }) {
  return runRefresh({ store, userId, channel, limit, force });
}

async function runRefresh({ store, userId, channel, limit = DEFAULT_PAGE_SIZE, force = false }) {
  const cacheKey = `${userId}:${channel}`;
  const now = Date.now();
  const existingState = refreshState.get(cacheKey);
  if (!force && existingState && now - existingState.refreshedAt < REFRESH_CACHE_TTL_MS) {
    return [];
  }
  if (refreshInFlight.has(cacheKey)) {
    return refreshInFlight.get(cacheKey);
  }

  const job = (async () => {
  const scope = { userId };
  const sources = (await ensureDefaultSources(store, userId, channel)).filter((source) => source.enabled);
  if (sources.length === 0) {
    refreshState.set(cacheKey, { refreshedAt: now, count: 0 });
    return [];
  }
  const perSourceLimit = Math.max(4, Math.ceil(limit / sources.length) + 2);
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

  const deduped = dedupeContentItems(collected).slice(0, Math.max(limit * 2, limit));
  if (deduped.length === 0) {
    refreshState.set(cacheKey, { refreshedAt: Date.now(), count: 0 });
    return [];
  }
    const persisted = await store.upsertContentItems(scope, deduped);
    refreshState.set(cacheKey, { refreshedAt: Date.now(), count: persisted.length });
    return persisted;
  })();

  refreshInFlight.set(cacheKey, job);
  try {
    return await job;
  } finally {
    refreshInFlight.delete(cacheKey);
  }
}

async function warmUserContent(store, userId) {
  for (const channel of CHANNELS) {
    await ensureFreshChannelContent({ store, userId, channel, force: true }).catch((error) => {
      console.warn("[content] warm user content failed", channel, error.message);
    });
  }
}

function startContentRefreshLoop(store) {
  const timer = setInterval(async () => {
    try {
      const users = typeof store.listUsers === "function" ? await store.listUsers() : [];
      for (const user of users) {
        await warmUserContent(store, user.id);
      }
    } catch (error) {
      console.warn("[content] refresh loop failed", error.message);
    }
  }, REFRESH_INTERVAL_MS);
  if (typeof timer.unref === "function") {
    timer.unref();
  }
  return timer;
}

async function fetchRssSource(source, channel, limit) {
  const feed = await parser.parseURL(source.url);
  const entries = Array.isArray(feed.items) ? feed.items.slice(0, limit) : [];
  const normalized = await Promise.all(
    entries.map((item) => normalizeFeedItem(item, source, channel)),
  );
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
    const summaryRaw =
      cleanText(root.find("p").first().text()) ||
      cleanText(root.text()).slice(0, 240);
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
  const normalized = await Promise.all(
    items.map((item) => normalizeContentItem(item, source, channel)),
  );
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
      type: inferContentType(channel, item, source),
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
    id: crypto.randomUUID(),
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
    is_featured: false,
    fetched_at: fetchedAt,
    created_at: fetchedAt,
    updated_at: fetchedAt,
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
    return truncate(bodyRaw, 1800);
  }
  const fallback = bodyRaw || summaryZh || title;
  if (!fallback) {
    return "暂无正文摘录。";
  }
  return `英文正文摘录：${truncate(fallback, 1800)}`;
}

function inferLanguage(title, summary) {
  return containsChinese(`${title} ${summary}`) ? "zh" : "en";
}

function containsChinese(text) {
  return /[\u3400-\u9fff]/.test(String(text || ""));
}

function inferContentType(channel, item, source) {
  const text = `${item.title || ""} ${(item.categories || []).join(" ")}`.toLowerCase();
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
    return { raw: truncate(baseText, 1800) };
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
    return { raw: truncate(candidate || baseText, 1800) };
  } catch (error) {
    return { raw: truncate(baseText, 1800) };
  }
}

module.exports = {
  CHANNELS,
  DEFAULT_PAGE_SIZE,
  DEFAULT_SOURCES,
  ensureDefaultSources,
  ensureFreshChannelContent,
  refreshChannelContent,
  startContentRefreshLoop,
  warmUserContent,
};
