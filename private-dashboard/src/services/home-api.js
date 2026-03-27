import { MAX_STOCK_WIDGET_ITEMS, contentTabs, defaultWidgets } from "../app/constants";
import { fetchJson } from "./api-client";
import { fetchContentList, fetchFeaturedContent as fetchNewsFeaturedContent } from "./content-api";

export function createEmptyWeatherState() {
  return {
    status: "idle",
    location: "位置待获取",
    temperature: "--",
    detail: "",
    message: "",
    forecast: [],
    source: "",
    updatedAt: "",
    latitude: null,
    longitude: null,
  };
}

export function createEmptyHomeState() {
  return {
    channelFeeds: Object.fromEntries(contentTabs.map((tab) => [tab.id, []])),
    financeFeed: [],
    scienceFeed: [],
    freshNewsFeed: [],
    favorites: {
      status: "idle",
      items: [],
      message: "",
    },
    github: {
      status: "idle",
      repos: [],
      url: "",
      message: "",
    },
    weather: createEmptyWeatherState(),
    stock: {
      status: "idle",
      symbols: [],
      updatedAt: "",
      message: "",
    },
  };
}

export function fetchFeaturedContent(channel, limit = 3) {
  return fetchNewsFeaturedContent(channel, limit);
}

export async function fetchFavoritesPreview(channel = "all") {
  const selectedChannels = channel === "all" ? contentTabs.map((tab) => tab.id) : [channel];
  const responses = await Promise.all(
    selectedChannels.map((channelId) =>
      fetchContentList({
        channel: channelId,
        favorite: "favorites",
        page: 1,
        pageSize: 3,
        sort: "latest",
      }).catch(() => ({ items: [] })),
    ),
  );

  return responses
    .flatMap((payload) => (Array.isArray(payload?.items) ? payload.items : []))
    .sort((left, right) => {
      const leftTime = new Date(left.favorited_at || left.published_at || left.created_at || 0).getTime();
      const rightTime = new Date(right.favorited_at || right.published_at || right.created_at || 0).getTime();
      return rightTime - leftTime;
    })
    .slice(0, 3);
}

export async function fetchGitHubPreview(profileUrl) {
  const owner = parseGitHubOwnerFromUrl(profileUrl);
  const fallback = {
    status: "fallback",
    repos: [
      {
        name: "DanN-55 / life-flow",
        description: "Dashboard preview for personal execution, market notes and research reading.",
        updatedAt: "",
        url: "https://github.com/DanN-55/life-flow",
        shortUrl: "life-flow",
      },
    ],
    url: profileUrl,
    message: "最近活跃仓库",
  };

  if (!owner || !profileUrl) {
    return {
      status: "idle",
      repos: [],
      url: profileUrl,
      message: "等待配置 GitHub 主页",
    };
  }

  const response = await fetch(`https://api.github.com/users/${owner}/repos?sort=pushed&per_page=6`, {
    headers: {
      Accept: "application/vnd.github+json",
    },
  });
  if (!response.ok) {
    return {
      ...fallback,
      status: "error",
      message: "GitHub 预览暂时不可用",
    };
  }

  const payload = await response.json();
  const repos = Array.isArray(payload)
    ? payload
        .filter((repo) => !repo.fork)
        .sort((left, right) => {
          const leftTime = new Date(left.pushed_at || left.updated_at || 0).getTime();
          const rightTime = new Date(right.pushed_at || right.updated_at || 0).getTime();
          return rightTime - leftTime;
        })
        .slice(0, 3)
        .map((repo) => ({
          name: repo.full_name || repo.name || "Repository",
          description: repo.description || "暂无仓库简介。",
          updatedAt: repo.pushed_at || repo.updated_at || "",
          url: repo.html_url || profileUrl,
          shortUrl: repo.name || "Open Repo",
        }))
    : [];

  return {
    status: "ready",
    repos: repos.length ? repos : fallback.repos,
    url: profileUrl,
    updatedAt: new Date().toISOString(),
    message: "最近活跃仓库",
  };
}

export async function fetchWeatherWidget(locationQuery) {
  const query = String(locationQuery || "").trim();
  const params = query ? `?query=${encodeURIComponent(query)}` : "";
  const payload = await fetchJson(`/api/widgets/weather${params}`, {
    requireAuth: false,
    timeoutMs: 6000,
  });
  return payload?.weather || createEmptyWeatherState();
}

export async function fetchStockWidget(symbolInput = defaultWidgets.stock.symbols) {
  const queries = normalizeSymbols(symbolInput)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, MAX_STOCK_WIDGET_ITEMS);

  if (!queries.length) {
    return {
      status: "idle",
      symbols: [],
      updatedAt: "",
      message: "等待配置股票代码",
    };
  }

  try {
    const resolved = await resolveAStockQueries(queries);
    if (!resolved.length) {
      throw new Error("No stock resolved");
    }
    const quotes = await fetchTencentQuotes(resolved.map((item) => item.symbol));
    const sparklines = await fetchTencentMinuteSparklines(resolved.map((item) => item.symbol)).catch(() => ({}));
    return {
      status: "ready",
      symbols: resolved.map((item) => {
        const quote = quotes.find((entry) => entry.symbol === item.symbol);
        if (!quote) {
          return {
            symbol: item.symbol,
            name: item.name,
            price: "--",
            change: "--",
            trend: "flat",
            sparkline: "",
          };
        }
        return {
          symbol: item.symbol.toUpperCase(),
          name: quote.name || item.name,
          price: quote.price,
          change: quote.change,
          trend: quote.trend,
          sparkline: sparklines[item.symbol] || "",
        };
      }),
      updatedAt: new Date().toISOString(),
      message: "A 股实时行情",
    };
  } catch {
    return {
      status: "error",
      symbols: queries.map((symbol) => ({
        symbol,
        name: symbol,
        price: "--",
        change: "--",
        trend: "flat",
        sparkline: "",
      })),
      updatedAt: "",
      message: "A 股行情获取失败，请检查代码或名称",
    };
  }
}

export function parseGitHubOwnerFromUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  try {
    const parsed = new URL(raw);
    if (!/github\.com$/i.test(parsed.hostname)) {
      return "";
    }
    const [owner] = parsed.pathname.split("/").filter(Boolean);
    return owner || "";
  } catch {
    return "";
  }
}

export function normalizeSymbols(value) {
  return String(value || "")
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .join(",");
}

export function formatDisplayStockCode(symbol) {
  const raw = String(symbol || "").trim();
  const matched = raw.match(/(?:sh|sz)?(\d{6})$/i);
  return matched ? matched[1] : raw.toUpperCase();
}

async function resolveAStockQueries(queries) {
  const results = [];
  for (const query of queries) {
    const resolved = isAStockCode(query) ? normalizeAStockCode(query) : await resolveStockByName(query);
    if (resolved) {
      results.push(resolved);
    }
  }
  return dedupeStocks(results);
}

function isAStockCode(query) {
  return /^(sh|sz)?\d{6}$/i.test(query);
}

function normalizeAStockCode(query) {
  const normalized = query.toLowerCase();
  if (/^(sh|sz)\d{6}$/.test(normalized)) {
    return { symbol: normalized, name: normalized.toUpperCase() };
  }
  const code = normalized.replace(/\D/g, "");
  const prefix = /^(5|6|9)/.test(code) ? "sh" : "sz";
  return { symbol: `${prefix}${code}`, name: code };
}

async function resolveStockByName(query) {
  const callbackName = `stock_suggest_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const raw = await loadScriptVariable(
    `https://suggest3.sinajs.cn/suggest/type=11,12,13,14,15&key=${encodeURIComponent(query)}&name=${callbackName}`,
    callbackName,
  );

  if (!raw) {
    return null;
  }

  const firstEntry = String(raw)
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)[0];

  if (!firstEntry) {
    return null;
  }

  const tokens = firstEntry
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const symbol = tokens.find((item) => /^(sh|sz)\d{6}$/i.test(item));
  const name = tokens.find((item) => /[\u4e00-\u9fa5]/.test(item)) || query;

  return symbol ? { symbol: symbol.toLowerCase(), name } : null;
}

function dedupeStocks(stocks) {
  const seen = new Set();
  return stocks.filter((item) => {
    if (seen.has(item.symbol)) {
      return false;
    }
    seen.add(item.symbol);
    return true;
  });
}

async function fetchTencentQuotes(symbols) {
  if (!symbols.length) {
    return [];
  }
  await loadRemoteScript(`https://qt.gtimg.cn/q=${symbols.join(",")}`);
  return symbols
    .map((symbol) => {
      const raw = window[`v_${symbol}`];
      if (!raw) {
        return null;
      }
      const parts = String(raw).split("~");
      const name = parts[1] || symbol.toUpperCase();
      const price = Number(parts[3]) || 0;
      const prevClose = Number(parts[4]) || 0;
      const changeValue = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
      return {
        symbol,
        name,
        price: price ? price.toFixed(2) : "--",
        change: `${changeValue >= 0 ? "+" : ""}${changeValue.toFixed(2)}%`,
        trend: changeValue > 0 ? "up" : changeValue < 0 ? "down" : "flat",
      };
    })
    .filter(Boolean);
}

async function fetchTencentMinuteSparklines(symbols) {
  const entries = await Promise.all(
    symbols.map(async (symbol) => {
      const sparkline = await fetchTencentMinuteSparkline(symbol).catch(() => "");
      return [symbol, sparkline];
    }),
  );

  return Object.fromEntries(entries.filter(([, sparkline]) => Boolean(sparkline)));
}

async function fetchTencentMinuteSparkline(symbol) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 4500);

  try {
    const response = await fetch(`https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=${encodeURIComponent(symbol)}`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Minute request failed: ${response.status}`);
    }

    const payload = await response.json();
    const rows = payload?.data?.[symbol]?.data?.data;
    return buildStockSparklinePoints(rows);
  } finally {
    window.clearTimeout(timeout);
  }
}

function buildStockSparklinePoints(rows) {
  const prices = Array.isArray(rows)
    ? rows
        .map((entry) => {
          const [, price] = String(entry || "").trim().split(/\s+/);
          return Number(price);
        })
        .filter((value) => Number.isFinite(value) && value > 0)
    : [];

  if (prices.length < 2) {
    return "";
  }

  const sampled = sampleSparklineValues(prices, 24);
  const min = Math.min(...sampled);
  const max = Math.max(...sampled);
  const range = max - min;

  if (!range) {
    return "0,9 80,9";
  }

  return sampled
    .map((value, index) => {
      const x = (index * 80) / Math.max(sampled.length - 1, 1);
      const y = 16 - ((value - min) / range) * 12;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function sampleSparklineValues(values, limit) {
  if (values.length <= limit) {
    return values;
  }

  const step = (values.length - 1) / (limit - 1);
  return Array.from({ length: limit }, (_, index) => values[Math.round(index * step)] ?? values[values.length - 1]);
}

function loadRemoteScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.remove();
      resolve();
    };
    script.onerror = () => {
      script.remove();
      reject(new Error(`Failed to load script: ${src}`));
    };
    document.head.appendChild(script);
  });
}

async function loadScriptVariable(src, variableName) {
  await loadRemoteScript(src);
  const value = window[variableName];
  try {
    delete window[variableName];
  } catch {
    window[variableName] = undefined;
  }
  return value;
}
