import { formatTime, parseIsoDate } from "./date-utils.js";

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
  const refreshSummary =
    contentState.lastRefreshStats && contentState.lastRefreshStats.totalSources
      ? `${contentState.lastRefreshStats.successCount} 个源成功 / ${contentState.lastRefreshStats.failureCount} 个源失败`
      : "";
  const refreshedDate = parseIsoDate(contentState.lastRefreshedAt);
  const refreshedAt = refreshedDate ? formatTime(refreshedDate) : "";
  if (contentState.loading) {
    return "正在同步最新资讯...";
  }
  if (contentState.usingMock) {
    return "当前显示测试资讯";
  }
  if (contentState.favoriteFilter !== "all") {
    const label = filterLabels[contentState.favoriteFilter] || "筛选结果";
    return contentState.total
      ? [`共 ${contentState.total} 条${label}`]
          .filter(Boolean)
          .join(" · ")
      : `当前没有${label}。`;
  }
  const total = Number(contentState.total || 0);
  if (!total) {
    return "当前暂无缓存资讯，请手动刷新。";
  }
  return [refreshSummary, `共 ${total} 条资讯`, refreshedAt]
    .filter(Boolean)
    .join(" · ");
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
  const raw = cleaned[0] || "";
  if (!raw) {
    return "暂无摘要。";
  }
  return raw;
}

export function getContentThumbnailUrl(item) {
  const value = String(item?.image_url || "").trim();
  return /^https?:\/\//i.test(value) ? value : "";
}

export function getContentThumbnailLabel(item) {
  const source = String(item?.source_name || item?.channel || "LF")
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff]+/g, " ")
    .trim();
  if (!source) {
    return "LF";
  }
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.slice(0, 2).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function getContentSourceIconUrl(item) {
  const candidate = String(item?.source_url || item?.canonical_url || "").trim();
  if (!/^https?:\/\//i.test(candidate)) {
    return "";
  }
  try {
    const url = new URL(candidate);
    return `${url.origin}/favicon.ico`;
  } catch (error) {
    return "";
  }
}
