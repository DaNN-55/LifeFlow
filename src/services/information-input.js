import { reactive, readonly } from "vue";

import { views } from "./state-continuity.js";

const CHANNEL = "news";
const inputsByScope = new WeakMap();

function itemTime(item = {}) {
  return new Date(item.published_at || item.fetched_at || item.created_at || 0).getTime() || 0;
}

function favoriteTime(item = {}) {
  return new Date(item.favorited_at || 0).getTime() || 0;
}

function itemKey(item = {}) {
  const canonicalUrl = String(item.canonical_url || "").trim();
  if (canonicalUrl) {
    try {
      const normalized = new URL(canonicalUrl);
      normalized.hash = "";
      return normalized.toString();
    } catch {
      return canonicalUrl;
    }
  }
  return String(item.id || "").trim();
}

function sourceKey(source = {}) {
  return String(source.id || "").trim();
}

function contentValues(collection = {}, channel = CHANNEL) {
  return Object.values(collection?.[channel] || {});
}

function toItem(item, favorite = false, read = false) {
  return readonly({
    ...item,
    ref: { id: itemKey(item) },
    is_favorite: Boolean(favorite || item.is_favorite),
    is_read: Boolean(read),
  });
}

function toSource(source) {
  return readonly({ ...source, ref: { id: sourceKey(source) } });
}

function isItemRead(item, readItems = {}) {
  return Boolean(readItems[itemKey(item)] || readItems[String(item.id || "")]);
}

function getVisibleData(data) {
  const preferences = data.preferences || {};
  const hiddenSources = preferences.content?.hiddenSources || {};
  const readItems = {
    ...(data.readItems || {}),
    ...(preferences.content?.readItems || {}),
  };
  const sources = contentValues(data.sources);
  const sourceById = new Map(sources.map((source) => [sourceKey(source), source]));
  const normalItems = contentValues(data.items);
  const favoriteItems = contentValues(data.favorites);
  const byIdentity = new Map();

  [...normalItems, ...favoriteItems].forEach((item) => {
    const key = itemKey(item);
    if (!key) return;
    const source = sourceById.get(String(item.source_id || ""));
    const hidden = Boolean(item.source_id && hiddenSources[`${CHANNEL}:${item.source_id}`]);
    const disabled = source?.enabled === false;
    if (!hidden && !disabled) {
      byIdentity.set(key, item);
    }
  });

  const favorites = new Set(favoriteItems.map(itemKey));
  return {
    preferences,
    sources,
    sourceById,
    normalItems,
    favoriteItems,
    readItems,
    visibleItems: [...byIdentity.values()].map((item) => toItem(
      item,
      favorites.has(itemKey(item)),
      isItemRead(item, readItems),
    )),
  };
}

function matches(item, filters) {
  const query = String(filters.search || "").trim().toLowerCase();
  if (query && ![item.title, item.summary_zh, item.summary_raw, item.source_name, item.author].join(" ").toLowerCase().includes(query)) return false;
  if (filters.tag !== "all" && !(item.tags || []).includes(filters.tag)) return false;
  if (filters.sourceId !== "all" && String(item.source_id || "") !== filters.sourceId) return false;
  if (filters.favoriteFilter === "favorites" && !item.is_favorite) return false;
  const read = Boolean(item.is_read);
  if (filters.favoriteFilter === "read" && !read) return false;
  if (filters.favoriteFilter === "unread" && read) return false;
  return true;
}

function sortItems(items, sort) {
  return [...items].sort((left, right) => (sort === "oldest" ? 1 : -1) * (itemTime(left) - itemTime(right)));
}

function buildSummary(items, limit = 5) {
  const sorted = [...items].sort((left, right) => {
    const unread = Number(Boolean(left.is_read)) - Number(Boolean(right.is_read));
    return unread || itemTime(right) - itemTime(left);
  });
  const picked = [];
  const usedTypes = new Set();
  for (const item of sorted) {
    const type = String(item.content_type || item.tags?.[0] || "资讯");
    if (usedTypes.has(type)) continue;
    usedTypes.add(type);
    picked.push(item);
    if (picked.length >= limit) return picked;
  }
  for (const item of sorted) {
    if (!picked.includes(item)) picked.push(item);
    if (picked.length >= limit) break;
  }
  return picked;
}

export function attachInformationInput(continuityScope) {
  const existing = inputsByScope.get(continuityScope);
  if (existing) return existing;
  const projection = continuityScope.view(views.information());
  const sessionState = reactive({
    page: 1,
    pageSize: 10,
    search: "",
    tag: "all",
    sourceId: "all",
    favoriteFilter: "all",
    sort: "latest",
  });
  let refreshPromise = null;

  function data() {
    return getVisibleData(projection.data);
  }

  function findItem(itemRef) {
    const id = String(itemRef?.id || "");
    return data().visibleItems.find((item) => itemKey(item) === id) || null;
  }

  function newsProjection() {
    const current = data();
    const filtered = sortItems(current.visibleItems.filter((item) => matches(item, sessionState)), sessionState.sort);
    const total = filtered.length;
    const maxPage = Math.max(1, Math.ceil(total / sessionState.pageSize));
    const page = Math.min(sessionState.page, maxPage);
    const start = (page - 1) * sessionState.pageSize;
    return readonly({
      items: filtered.slice(start, start + sessionState.pageSize),
      sources: current.sources.filter((source) => !current.preferences.content?.hiddenSources?.[`${CHANNEL}:${sourceKey(source)}`]).map(toSource),
      hiddenSources: current.sources.filter((source) => current.preferences.content?.hiddenSources?.[`${CHANNEL}:${sourceKey(source)}`]).map(toSource),
      tags: [...new Set(current.visibleItems.flatMap((item) => item.tags || []))].sort(),
      search: sessionState.search,
      tag: sessionState.tag,
      sourceId: sessionState.sourceId,
      favoriteFilter: sessionState.favoriteFilter,
      sort: sessionState.sort,
      page,
      pageSize: sessionState.pageSize,
      total,
      freshness: projection.freshness,
      activity: projection.activity,
      issue: projection.issue,
      mode: projection.freshness === "demo" ? "demo" : "remote",
    });
  }

  const newsSession = readonly({
    get projection() { return newsProjection(); },
    browse(filters = {}) {
      const changesFilter = ["search", "tag", "sourceId", "favoriteFilter", "sort"].some((key) => Object.hasOwn(filters, key) && filters[key] !== sessionState[key]);
      Object.assign(sessionState, filters);
      if (changesFilter) sessionState.page = 1;
      return newsProjection();
    },
    reset() {
      Object.assign(sessionState, { page: 1, search: "", tag: "all", sourceId: "all", favoriteFilter: "all", sort: "latest" });
      return newsProjection();
    },
    close() {},
  });

  function homeProjection() {
    const current = data();
    return readonly({
      summary: buildSummary(current.visibleItems),
      favorites: current.visibleItems
        .filter((item) => item.is_favorite)
        .sort((left, right) => favoriteTime(right) - favoriteTime(left)
          || itemTime(right) - itemTime(left)
          || String(left.id || "").localeCompare(String(right.id || "")))
        .slice(0, 3),
      freshness: projection.freshness,
    });
  }

  function sidebarProjection() {
    const home = homeProjection();
    return readonly({ news: home.summary, favorites: { status: home.favorites.length ? "ready" : "empty", items: home.favorites, message: home.favorites.length ? "最近收藏资讯" : "当前还没有收藏资讯。" }, freshness: home.freshness });
  }

  function change(builder) {
    return continuityScope.change((catalog) => builder({
      toggleFavorite(itemRef) {
        const item = findItem(itemRef);
        if (!item) throw new Error("资讯不存在");
        return catalog.information.toggleFavorite({
          itemId: String(item.id || ""),
          canonicalUrl: String(item.canonical_url || item.source_url || ""),
          favorited: Boolean(item.is_favorite),
          item: { ...item, channel: CHANNEL },
        });
      },
      toggleRead(itemRef) {
        const item = findItem(itemRef);
        const id = String(itemRef?.id || "");
        return catalog.information.toggleRead(id, String(item?.id || ""));
      },
      markRead(itemRef) {
        const item = findItem(itemRef);
        const id = String(itemRef?.id || "");
        return catalog.information.markRead(id, String(item?.id || ""));
      },
      setSourceHidden(sourceRef, hidden) {
        const id = String(sourceRef?.id || "");
        return catalog.information.setSourceHidden(id, Boolean(hidden));
      },
      setSourceEnabled(sourceRef, enabled) {
        return catalog.information.sourceUpdate(String(sourceRef?.id || ""), { enabled: Boolean(enabled) });
      },
      createSource(source) { return catalog.information.sourceCreate({ ...source, channel: CHANNEL }); },
      updateSource(sourceRef, source) { return catalog.information.sourceUpdate(String(sourceRef?.id || ""), source); },
      deleteSource(sourceRef) { return catalog.information.sourceDelete(String(sourceRef?.id || "")); },
      refresh() { return catalog.information.refresh(); },
    }));
  }

  const input = readonly({
    news: () => newsSession,
    home: homeProjection,
    sidebar: sidebarProjection,
    open(itemRef) {
      const item = findItem(itemRef);
      const target = String(item?.canonical_url || item?.source_url || "");
      if (item) change((catalog) => catalog.markRead(itemRef)).catch(() => {});
      return target ? { href: target } : null;
    },
    change,
    refresh() {
      if (!refreshPromise) {
        refreshPromise = change((catalog) => catalog.refresh()).then((result) => result?.report || result || {}).finally(() => {
          refreshPromise = null;
        });
      }
      return refreshPromise;
    },
  });
  inputsByScope.set(continuityScope, input);
  return input;
}
