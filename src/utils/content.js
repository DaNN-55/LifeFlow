import { formatTime, parseIsoDate } from "./date";

export function normalizePrimaryContentTag(tag = "") {
  const cleaned = String(tag || "").replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return "";
  }
  const [primary] = cleaned.split(/\s*\/\s*|\s*>\s*|\s*::\s*/);
  return String(primary || "").replace(/\s+/g, " ").trim();
}

export function normalizeContentTagList(tags = []) {
  const values = Array.isArray(tags) ? tags : [tags];
  return [...new Set(values.map((tag) => normalizePrimaryContentTag(tag)).filter(Boolean))].slice(0, 8);
}

export function getSafeContentLink(item) {
  const candidates = [item?.canonical_url, item?.source_url];
  return candidates.find((value) => /^https?:\/\//i.test(String(value || "").trim())) || "";
}

export function getContentMetaText(contentState) {
  const filterLabels = {
    favorites: "收藏资讯",
    unread: "未读资讯",
    read: "已读资讯",
  };
  const isLocalMode = contentState?.mode === "local";
  const refreshSummary =
    contentState.lastRefreshStats && contentState.lastRefreshStats.totalSources
      ? `${contentState.lastRefreshStats.successCount} 个源成功 / ${contentState.lastRefreshStats.failureCount} 个源失败`
      : "";
  const refreshedDate = parseIsoDate(contentState.lastRefreshedAt);
  const refreshedAt = refreshedDate ? formatTime(refreshedDate) : "";

  if (contentState.loading) {
    return isLocalMode ? "正在刷新本地缓存..." : "正在同步最新资讯...";
  }
  if (contentState.favoriteFilter !== "all") {
    const label = filterLabels[contentState.favoriteFilter] || "筛选结果";
    const prefix = isLocalMode ? "本地模式" : "";
    return contentState.total ? [prefix, `共 ${contentState.total} 条${label}`].filter(Boolean).join(" · ") : `当前没有${label}。`;
  }
  const total = Number(contentState.total || 0);
  if (!total) {
    return isLocalMode ? "本地缓存里暂时没有内容，试试刷新本地缓存。" : "当前暂无缓存资讯，请手动刷新。";
  }
  if (isLocalMode) {
    return ["本地模式", `共 ${total} 条演示资讯`, refreshedAt ? `缓存更新于 ${refreshedAt}` : ""].filter(Boolean).join(" · ");
  }
  return [refreshSummary, `共 ${total} 条资讯`, refreshedAt].filter(Boolean).join(" · ");
}

export function getContentCardExcerpt(item) {
  const isExtendedExcerptChannel = item?.channel === "science" || item?.channel === "ai";
  const candidates = isExtendedExcerptChannel
    ? [item?.body_raw, item?.body_zh, item?.summary_raw, item?.summary_zh]
    : [item?.summary_zh, item?.summary_raw, item?.body_zh, item?.body_raw];
  const cleaned = candidates
    .map((value) =>
      String(value || "")
        .replace(/^(中文摘要|英文摘要|摘要|全文内容|英文正文摘录|英文正文内容)\s*[:：]\s*/i, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
  return cleaned[0] || "暂无摘要。";
}

export function getContentThumbnailUrl(item) {
  const value = String(item?.image_url || "").trim();
  return /^https?:\/\//i.test(value) ? value : "";
}

export function getContentSourceIconUrl(item) {
  const candidate = String(item?.source_url || item?.canonical_url || "").trim();
  if (!/^https?:\/\//i.test(candidate)) {
    return "";
  }
  try {
    const url = new URL(candidate);
    return `${url.origin}/favicon.ico`;
  } catch {
    return "";
  }
}

export function getContentTagTone(label = "", fallbackTone = "neutral") {
  const normalized = String(label || "").trim().toLowerCase();
  if (!normalized) {
    return fallbackTone;
  }
  if (/ecology|environment|climate|sustainability|biodiversity|conservation|生态|环境|气候/.test(normalized)) {
    return "ecology";
  }
  if (/mathematics|math|algebra|geometry|statistics|probability|数学|统计|概率|几何/.test(normalized)) {
    return "mathematics";
  }
  if (/plants|animals|biology|botany|zoology|wildlife|species|植物|动物|生物/.test(normalized)) {
    return "biology";
  }
  if (/ai|artificial intelligence|machine learning|llm|人工智能|机器学习/.test(normalized)) {
    return "ai";
  }
  if (/space|astronomy|cosmos|nasa|rocket|宇宙|航天|天文|火箭/.test(normalized)) {
    return "space";
  }
  if (/finance|market|stock|earnings|economy|investment|trading|macro|基金|股票|市场|财经|金融|证券|投资/.test(normalized)) {
    return "finance";
  }
  if (/business|company|startup|enterprise|merger|公司|企业|商业|创业/.test(normalized)) {
    return "business";
  }
  if (/science|research|nature|cell|biology|medical|medicine|health|tech|space|科研|科学|研究|医学|技术/.test(normalized)) {
    return "science";
  }
  if (/policy|government|fed|regulation|law|politics|政策|监管|政府|法律|政治/.test(normalized)) {
    return "policy";
  }
  if (/energy|climate|oil|gas|battery|电力|能源|气候|石油|天然气|电池/.test(normalized)) {
    return "energy";
  }
  return fallbackTone;
}

export function getContentMetaTone(contentState) {
  if (contentState.error) {
    return "error";
  }
  if (contentState.refreshing || contentState.loading) {
    return "progress";
  }
  if (contentState.lastRefreshStats) {
    return "success";
  }
  return "default";
}
