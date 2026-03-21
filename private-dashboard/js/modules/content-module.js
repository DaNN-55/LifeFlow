import { buildMockContent, getMockContentPayload } from "./content-mocks.js";
import {
  getContentCardExcerpt,
  getContentMetaText,
  getSafeContentLink,
  getContentSourceIconUrl,
  getContentThumbnailLabel,
  getContentThumbnailUrl,
} from "./content-helpers.js";

export function createContentModule(deps) {
  const {
    state,
    elements,
    contentChannelIds,
    contentTabs,
    getContentTabConfig,
    escapeHtml,
    escapeAttribute,
    formatDateTime,
    fetchApiJson,
    isLocalDevelopment,
    getSidebarPreferences,
    persistStateSilently,
    saveAccountPreferencesRemote,
    renderTopTabs,
    renderWidgets,
    setSaveStatus,
  } = deps;
  let contentSearchDebounceTimer = null;

  function getContentElements(channel) {
    return elements.contentByChannel?.[channel] || null;
  }

  function renderFeedInto(container, items, channel) {
    if (!Array.isArray(items) || items.length === 0) {
      const contentState = state.content[channel];
      const message = contentState?.loading || !contentState?.loaded ? "加载中..." : "加载中...";
      container.innerHTML = `<div class="content-empty-state">${message}</div>`;
      return;
    }
    container.innerHTML = items
      .map(
        (item) => `
          <article class="feed-item">
            <h3>
              <a href="${escapeAttribute(getSafeContentLink(item) || "#")}" target="_blank" rel="noreferrer">
                ${escapeHtml(item.title)}
              </a>
            </h3>
            <div class="feed-meta-stack">
              <p class="feed-meta">${escapeHtml(item.source_name || "未知来源")}</p>
              <p class="feed-meta">${escapeHtml(formatDateTime(item.published_at || item.fetched_at))}</p>
            </div>
          </article>
        `,
      )
      .join("");
  }

  function renderFeeds() {
    if (elements.financeFeed && state.content.finance) {
      renderFeedInto(elements.financeFeed, state.content.finance.featured, "finance");
    }
    if (elements.scienceFeed && state.content.science) {
      renderFeedInto(elements.scienceFeed, state.content.science.featured, "science");
    }
  }

  function getContentChannelState(channel) {
    return state.content[channel] || null;
  }

  function getContentPreferences() {
    if (!state.data.preferences.content) {
      state.data.preferences.content = {
        readItems: {},
        hiddenSources: {},
      };
    }
    if (state.data.preferences.content.laterItems) {
      delete state.data.preferences.content.laterItems;
    }
    return state.data.preferences.content;
  }

  function getContentItemKey(item) {
    return String(item?.canonical_url || item?.id || "").trim();
  }

  function getContentTagTone(label = "", fallbackTone = "neutral") {
    const normalized = String(label || "").trim().toLowerCase();
    if (!normalized) {
      return fallbackTone;
    }
    if (
      /ecology|environment|climate|sustainability|biodiversity|conservation|生态|环境|气候|可持续|生物多样性/.test(
        normalized,
      )
    ) {
      return "ecology";
    }
    if (
      /mathematics|math|algebra|geometry|statistics|probability|拓扑|数学|统计|概率|几何/.test(
        normalized,
      )
    ) {
      return "mathematics";
    }
    if (
      /plants|animals|biology|botany|zoology|wildlife|species|植物|动物|生物|物种|野生/.test(
        normalized,
      )
    ) {
      return "biology";
    }
    if (/ai|artificial intelligence|machine learning|llm|芯片|人工智能|机器学习/.test(normalized)) {
      return "ai";
    }
    if (/space|astronomy|cosmos|nasa|rocket|宇宙|航天|天文|火箭/.test(normalized)) {
      return "space";
    }
    if (
      /finance|market|stock|earnings|economy|investment|trading|macro|基金|股票|市场|财经|金融|证券|投资/.test(
        normalized,
      )
    ) {
      return "finance";
    }
    if (/business|company|startup|enterprise|merger|收购|公司|企业|商业|创业/.test(normalized)) {
      return "business";
    }
    if (
      /science|research|nature|cell|biology|medical|medicine|health|ai|tech|space|科研|科学|研究|医学|技术|太空/.test(
        normalized,
      )
    ) {
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

  function renderContentTag(label, fallbackTone = "neutral") {
    const tone = getContentTagTone(label, fallbackTone);
    return `<span class="content-tag is-${tone}">${escapeHtml(label)}</span>`;
  }

  function isContentItemRead(item) {
    const key = getContentItemKey(item);
    return Boolean(key && getContentPreferences().readItems[key]);
  }

  function isSourceHidden(channel, sourceId) {
    return Boolean(sourceId && getContentPreferences().hiddenSources?.[`${channel}:${sourceId}`]);
  }

  async function persistContentPreferences(successMessage, tone = "success") {
    persistStateSilently();
    if (state.auth.user) {
      try {
        await saveAccountPreferencesRemote();
      } catch (error) {
        console.warn("Failed to sync content preferences remotely.", error);
        if (successMessage) {
          setSaveStatus(`${successMessage}，已保存在本地，云端同步稍后重试`);
        }
        return;
      }
    }
    if (successMessage) {
      setSaveStatus(successMessage, tone);
    }
  }

  function getFilteredItems(channel, items = []) {
    const contentState = state.content[channel];
    if (!["all", "favorites", "unread", "read"].includes(contentState.favoriteFilter)) {
      contentState.favoriteFilter = "all";
    }
    return items.filter((item) => {
      if (isSourceHidden(channel, item.source_id || "")) {
        return false;
      }
      if (contentState.favoriteFilter === "read" && !isContentItemRead(item)) {
        return false;
      }
      if (contentState.favoriteFilter === "unread" && isContentItemRead(item)) {
        return false;
      }
      return true;
    });
  }

  function scrollContentChannelToTop(channel) {
    const view = getContentElements(channel)?.view;
    const shell = view?.querySelector(".content-stream-shell");
    if (!shell) {
      return;
    }
    shell.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderContentChannel(channel) {
    const contentState = state.content[channel];
    const channelElements = getContentElements(channel);
    if (!contentState || !channelElements?.grid) {
      return;
    }

    channelElements.search.value = contentState.search;
    channelElements.sortFilter.value = contentState.sort;
    channelElements.favoriteFilter.value = contentState.favoriteFilter;
    channelElements.tagFilter.innerHTML = [
      '<option value="all">全部标签</option>',
      ...contentState.tags.map((tag) => `<option value="${escapeAttribute(tag)}">${escapeHtml(tag)}</option>`),
    ].join("");
    channelElements.sourceFilter.innerHTML = [
      '<option value="all">全部来源</option>',
      ...contentState.sources.map(
        (source) => `<option value="${escapeAttribute(source.id)}">${escapeHtml(source.name)}</option>`,
      ),
    ].join("");
    channelElements.tagFilter.value = contentState.tag;
    channelElements.sourceFilter.value = contentState.sourceId;
    const metaText = contentState.error
      ? contentState.error
      : getContentMetaText(contentState);
    channelElements.meta.textContent = metaText;
    channelElements.meta.hidden = !metaText;
    channelElements.meta.dataset.tone = getContentMetaTone(contentState);

    if (contentState.loading && contentState.items.length === 0) {
      channelElements.grid.innerHTML = '<div class="content-empty-state">正在加载资讯...</div>';
      channelElements.pagination.innerHTML = "";
      return;
    }

    if (contentState.error && contentState.items.length === 0) {
      channelElements.grid.innerHTML = `<div class="content-empty-state">${escapeHtml(contentState.error)}</div>`;
      channelElements.pagination.innerHTML = "";
      return;
    }

    if (contentState.items.length === 0) {
      channelElements.grid.innerHTML = '<div class="content-empty-state">暂无资讯，试试手动刷新或添加信源。</div>';
      channelElements.pagination.innerHTML = "";
      return;
    }

    channelElements.grid.innerHTML = contentState.items
      .map(
        (item) => {
          const thumbnailUrl = getContentThumbnailUrl(item);
          const contentLink = getSafeContentLink(item);
          const sourceLabel = item.source_name || "未知来源";
          const sourceIconUrl = getContentSourceIconUrl(item);
          const publishedAt = formatDateTime(item.published_at || item.fetched_at);
          return `
          <article class="content-card ${item.is_favorite ? "is-favorited" : ""} ${isContentItemRead(item) ? "is-read" : ""}">
            <div class="content-card-thumb ${thumbnailUrl ? "has-image" : "is-fallback"}" aria-hidden="true">
              ${
                thumbnailUrl
                  ? `<img src="${escapeAttribute(thumbnailUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
                  : `<span class="content-card-thumb-badge">${escapeHtml(getContentThumbnailLabel(item))}</span>`
              }
            </div>
            <div class="content-card-body">
              <div class="content-card-main">
                <h3>
                  ${
                    contentLink
                      ? `<a
                          href="${escapeAttribute(contentLink)}"
                          target="_blank"
                          rel="noreferrer"
                          class="content-title-link"
                          data-content-open-link="${escapeAttribute(contentLink)}"
                          data-content-item-id="${escapeAttribute(item.id)}"
                        >${escapeHtml(item.title)}</a>`
                      : escapeHtml(item.title)
                  }
                </h3>
                <p class="content-card-summary">${escapeHtml(getContentCardExcerpt(item))}</p>
                <div class="content-card-meta-row">
                  <div class="content-card-meta">
                    <span class="content-card-source">
                      ${
                        sourceIconUrl
                          ? `<img class="content-source-icon" src="${escapeAttribute(sourceIconUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true" />`
                          : ""
                      }
                      <span>${escapeHtml(sourceLabel)}</span>
                    </span>
                    <span>${escapeHtml(publishedAt)}</span>
                  </div>
                </div>
              </div>
              <div class="content-card-footer">
                ${
                  Array.isArray(item.tags) && item.tags.length
                    ? `<div class="content-card-tags">${item.tags
                        .slice(0, 4)
                        .map((tag) => renderContentTag(tag, item.channel))
                        .join("")}</div>`
                    : `<div class="content-card-tags">${renderContentTag("资讯", item.channel)}</div>`
                }
                <div class="content-card-actions">
                  <button
                    type="button"
                    class="content-read-button ${isContentItemRead(item) ? "is-active" : ""}"
                    data-content-read-toggle="${escapeAttribute(item.id)}"
                  >
                    ${isContentItemRead(item) ? "已读" : "未读"}
                  </button>
                  <button
                    type="button"
                    class="content-favorite-button ${item.is_favorite ? "is-active" : ""}"
                    data-content-favorite="${escapeAttribute(item.id)}"
                    aria-label="${item.is_favorite ? "取消收藏" : "收藏资讯"}"
                  >
                    ${item.is_favorite ? "取消收藏" : "收藏"}
                  </button>
                </div>
              </div>
            </div>
          </article>
        `;
        },
      )
      .join("");

    const totalPages = Math.max(1, Math.ceil(contentState.total / contentState.pageSize));
    channelElements.pagination.innerHTML = `
      <button type="button" class="task-cancel-action" data-content-page="${channel}:${contentState.page - 1}" ${
        contentState.page <= 1 ? "disabled" : ""
      }>上一页</button>
      <span class="content-page-indicator">第 ${contentState.page} / ${totalPages} 页</span>
      <button type="button" class="task-cancel-action" data-content-page="${channel}:${contentState.page + 1}" ${
        contentState.page >= totalPages ? "disabled" : ""
      }>下一页</button>
    `;
  }

  function renderContentStreams() {
    contentChannelIds.forEach((channel) => renderContentChannel(channel));
  }

  function renderContentSourceModal() {
    if (!elements.contentSourceModal || !elements.contentSourceList || !elements.contentSourceTitle) {
      return;
    }
    const channel = state.content.sourceModalChannel;
    elements.contentSourceModal.hidden = !channel;
    if (!channel) {
      return;
    }
    const channelLabel = getContentTabConfig(channel)?.label || channel;
    elements.contentSourceTitle.textContent = `${channelLabel} 信源管理`;
    const sources = state.content[channel].sources || [];
    const hiddenSources = sources.filter((source) => isSourceHidden(channel, source.id));
    const refreshFailures = state.content[channel].lastRefreshStats?.failures || [];
    const editingSource = sources.find((source) => source.id === state.content.sourceEditingId) || null;
    if (elements.contentSourceForm) {
      elements.contentSourceForm.dataset.channel = channel;
      elements.contentSourceId.value = editingSource?.id || "";
      elements.contentSourceForm.elements.name.value = editingSource?.name || "";
      elements.contentSourceForm.elements.type.value = editingSource?.type || "rss";
      elements.contentSourceForm.elements.url.value = editingSource?.url || "";
      elements.contentSourceForm.elements.parserKey.value = editingSource?.parser_key || "";
      elements.contentSourceForm.elements.enabled.value = String(
        typeof editingSource?.enabled === "boolean" ? editingSource.enabled : true,
      );
    }
    elements.contentSourceList.innerHTML = `
      ${
        hiddenSources.length
          ? `<section class="content-source-muted-list">
              <h3>已隐藏来源</h3>
              ${hiddenSources
                .map(
                  (source) => `
                    <article class="content-source-item">
                      <div>
                        <strong>${escapeHtml(source.name)}</strong>
                        <p>${escapeHtml(source.url)}</p>
                      </div>
                      <div class="content-source-item-actions">
                        <button type="button" class="task-cancel-action" data-content-source-unhide="${escapeAttribute(source.id)}">恢复显示</button>
                      </div>
                    </article>
                  `,
                )
                .join("")}
            </section>`
          : ""
      }
      ${
        sources.length
          ? sources
          .filter((source) => !isSourceHidden(channel, source.id))
          .map((source) => {
            const recentFailure = refreshFailures.find((item) => item.sourceId === source.id);
            return `
              <article class="content-source-item">
                <div>
                  <strong>${escapeHtml(source.name)}</strong>
                  <p>${escapeHtml(source.url)}</p>
                  <span class="feed-meta">${escapeHtml(source.type)} · ${source.enabled ? "已启用" : "已停用"}</span>
                  ${
                    recentFailure
                      ? `<p class="content-source-status is-error">最近刷新失败 · ${escapeHtml(recentFailure.message || "未知错误")}</p>`
                      : ""
                  }
                </div>
                <div class="content-source-item-actions">
                  <button type="button" class="task-cancel-action" data-content-source-edit="${escapeAttribute(source.id)}">编辑</button>
                  <button type="button" class="task-cancel-action" data-content-source-hide="${escapeAttribute(source.id)}">隐藏来源</button>
                  ${
                    source.is_default
                      ? ""
                      : `<button type="button" class="delete-task" data-content-source-delete="${escapeAttribute(source.id)}">删除</button>`
                  }
                </div>
              </article>
            `;
          })
          .join("")
          : '<div class="content-empty-state">当前没有可用信源。</div>'
      }
    `;
  }

  async function loadFeaturedContent(channel) {
    if (!state.auth.user) {
      return;
    }
    try {
      const payload = await fetchApiJson(`/api/content/featured?channel=${channel}&limit=3`);
      state.content[channel].featured = Array.isArray(payload?.items) ? payload.items : [];
      state.content[channel].usingMock = false;
      renderFeeds();
    } catch (error) {
      console.warn(`Failed to load ${channel} featured content.`, error);
      if (isLocalDevelopment() && error?.message === "Request failed: 404") {
        state.content[channel].featured = buildMockContent(channel).slice(0, 3);
        state.content[channel].usingMock = true;
        renderFeeds();
      }
    }
  }

  async function refreshFavoriteHighlights() {
    if (!state.auth.user) {
      state.widgetData.favorites = {
        status: "idle",
        items: [],
        message: "登录后可查看最近收藏的资讯。",
      };
      renderWidgets();
      return;
    }
    if (!getSidebarPreferences().favorites) {
      state.widgetData.favorites = {
        status: "idle",
        items: [],
        message: "收藏资讯已隐藏。",
      };
      renderWidgets();
      return;
    }
    try {
      const payloads = await Promise.all(
        contentChannelIds.map((channel) =>
          fetchApiJson(`/api/content?channel=${encodeURIComponent(channel)}&page=1&pageSize=3&favorite=favorites&sort=latest`),
        ),
      );
      const merged = payloads
        .flatMap((payload) => payload?.items || [])
        .sort((left, right) => {
          const leftTime = new Date(left.published_at || left.favorited_at || left.created_at || 0).getTime();
          const rightTime = new Date(right.published_at || right.favorited_at || right.created_at || 0).getTime();
          return rightTime - leftTime;
        })
        .slice(0, 3);
      state.widgetData.favorites = {
        status: "ready",
        items: merged,
        message: merged.length ? "最近收藏的资讯" : "当前还没有收藏资讯。",
      };
    } catch (error) {
      console.warn("Failed to load favorite highlights.", error);
      state.widgetData.favorites = {
        status: "error",
        items: [],
        message: "收藏资讯暂时不可用。",
      };
    }
    renderWidgets();
  }

  async function loadChannelContent(channel, options = {}) {
    if (!state.auth.user) {
      return;
    }
    const contentState = state.content[channel];
    if (!contentState) {
      return;
    }
    if (typeof options.page === "number") {
      contentState.page = options.page;
    }
    if (typeof options.search === "string") {
      contentState.search = options.search;
    }
    if (typeof options.tag === "string") {
      contentState.tag = options.tag;
    }
    if (typeof options.sourceId === "string") {
      contentState.sourceId = options.sourceId;
    }
    if (typeof options.favorite === "string") {
      contentState.favoriteFilter = options.favorite;
    }
    if (typeof options.sort === "string") {
      contentState.sort = options.sort;
    }
    contentState.loading = true;
    contentState.error = "";
    renderContentChannel(channel);

    try {
      const usesRemoteFavoriteFilter = contentState.favoriteFilter === "favorites";
      const requestedPageSize = usesRemoteFavoriteFilter
        ? Math.max(1, Math.min(Number(contentState.pageSize) || 10, 40))
        : 40;
      const params = new URLSearchParams({
        channel,
        page: String(usesRemoteFavoriteFilter ? contentState.page : 1),
        pageSize: String(requestedPageSize),
        sort: contentState.sort,
      });
      if (contentState.search) params.set("q", contentState.search);
      if (contentState.tag !== "all") params.set("tag", contentState.tag);
      if (contentState.sourceId !== "all") params.set("sourceId", contentState.sourceId);
      if (usesRemoteFavoriteFilter) params.set("favorite", contentState.favoriteFilter);
      const payload = await fetchApiJson(`/api/content?${params.toString()}`);
      const remoteItems = Array.isArray(payload?.items) ? payload.items : [];
      const filteredItems = usesRemoteFavoriteFilter ? remoteItems : getFilteredItems(channel, remoteItems);
      const startIndex = (contentState.page - 1) * contentState.pageSize;
      contentState.items = usesRemoteFavoriteFilter
        ? filteredItems
        : filteredItems.slice(startIndex, startIndex + contentState.pageSize);
      contentState.total = usesRemoteFavoriteFilter ? Number(payload?.total || 0) : filteredItems.length;
      if (contentState.total > 0) {
        const maxPage = Math.max(1, Math.ceil(contentState.total / contentState.pageSize));
        contentState.page = Math.min(Math.max(1, Number(contentState.page || 1)), maxPage);
        if (!usesRemoteFavoriteFilter) {
          const localStart = (contentState.page - 1) * contentState.pageSize;
          contentState.items = filteredItems.slice(localStart, localStart + contentState.pageSize);
        }
      } else {
        contentState.page = 1;
      }
      contentState.tags = Array.isArray(payload?.tags) ? payload.tags : [];
      contentState.sources = Array.isArray(payload?.sources) ? payload.sources : [];
      contentState.lastRefreshedAt = payload?.cache?.refreshedAt || contentState.lastRefreshedAt || "";
      contentState.lastRefreshStats = payload?.cache?.lastRefreshStats || contentState.lastRefreshStats || null;
      contentState.loaded = true;
      contentState.usingMock = false;
    } catch (error) {
      console.warn(`Failed to load ${channel} content.`, error);
      if (isLocalDevelopment() && error?.message === "Request failed: 404") {
        const mockPayload = getMockContentPayload(channel, contentState);
        contentState.items = mockPayload.items;
        contentState.total = mockPayload.total;
        contentState.page = mockPayload.page;
        contentState.tags = mockPayload.tags;
        contentState.sources = mockPayload.sources;
        contentState.loaded = true;
        contentState.usingMock = true;
        contentState.error = "";
      } else {
        contentState.error = error?.message || "资讯加载失败";
      }
    } finally {
      contentState.loading = false;
      renderContentChannel(channel);
    }
  }

  async function refreshChannelContentManually(channel, options = {}) {
    const contentState = state.content[channel];
    if (!contentState || contentState.refreshing) {
      return;
    }
    contentState.refreshing = true;
    renderContentChannel(channel);
    try {
      const payload = await fetchApiJson("/api/content/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, limit: 30 }),
      });
      if (options.featuredOnly) {
        await loadFeaturedContent(channel);
      } else {
        await Promise.all([loadChannelContent(channel), loadFeaturedContent(channel)]);
      }
      contentState.autoRefreshed = options.markAuto !== false;
      contentState.lastRefreshedAt = payload?.cache?.refreshedAt || payload?.refresh?.refreshedAt || "";
      contentState.lastRefreshStats = payload?.refresh || payload?.cache?.lastRefreshStats || null;
      renderContentChannel(channel);
    } catch (error) {
      console.warn(`Failed to refresh ${channel} content.`, error);
      contentState.error = error?.message || "资讯刷新失败";
      renderContentChannel(channel);
    } finally {
      contentState.refreshing = false;
      renderContentChannel(channel);
    }
  }

  function getContentMetaTone(contentState) {
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

  async function prefetchContentFeedsOnSessionStart() {
    if (!state.auth.user) {
      return;
    }
    const sidebar = getSidebarPreferences();
    const jobs = [];
    if (sidebar.financeFeed && state.content.finance?.featured.length === 0) {
      jobs.push(refreshChannelContentManually("finance", { silent: true, markAuto: true, featuredOnly: true }));
    }
    if (sidebar.scienceFeed && state.content.science?.featured.length === 0) {
      jobs.push(refreshChannelContentManually("science", { silent: true, markAuto: true, featuredOnly: true }));
    }
    if (!jobs.length) {
      return;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    await Promise.allSettled(jobs);
  }

  function findLocalContentItem(itemId) {
    return contentChannelIds
      .flatMap((channel) => [
        ...(state.content[channel]?.items || []),
        ...(state.content[channel]?.featured || []),
      ])
      .find((item) => item.id === itemId);
  }

  async function toggleContentFavorite(itemId) {
    if (!itemId || !state.auth.user) {
      return;
    }
    const item = findLocalContentItem(itemId);
    if (!item) {
      return;
    }
    try {
      if (item.is_favorite) {
        await fetchApiJson(
          `/api/content/favorites?channel=${encodeURIComponent(item.channel)}&canonicalUrl=${encodeURIComponent(item.canonical_url)}`,
          { method: "DELETE" },
        );
        setSaveStatus("已取消收藏", "success");
      } else {
        await fetchApiJson("/api/content/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: item.id,
            channel: item.channel,
            source_id: item.source_id || "",
            title: item.title,
            summary_zh: item.summary_zh || "",
            summary_raw: item.summary_raw || "",
            body_zh: item.body_zh || "",
            body_raw: item.body_raw || "",
            author: item.author || "",
            published_at: item.published_at || item.fetched_at || "",
            content_type: item.content_type || "",
            source_name: item.source_name || "",
            source_url: item.source_url || "",
            canonical_url: item.canonical_url,
            tags: Array.isArray(item.tags) ? item.tags : [],
            lang: item.lang || "unknown",
            image_url: item.image_url || "",
          }),
        });
        setSaveStatus("已加入收藏", "success");
      }
      await Promise.all([
        loadChannelContent(item.channel),
        loadFeaturedContent(item.channel),
        refreshFavoriteHighlights(),
      ]);
    } catch (error) {
      console.warn("Failed to toggle content favorite.", error);
      setSaveStatus(error?.message || "收藏操作失败");
    }
  }

  async function toggleContentRead(itemId, options = {}) {
    const item = findLocalContentItem(itemId);
    if (!item) {
      return;
    }
    const key = getContentItemKey(item);
    if (!key) {
      return;
    }
    const preferences = getContentPreferences();
    if (isContentItemRead(item)) {
      delete preferences.readItems[key];
      renderContentChannel(item.channel);
      await persistContentPreferences("已标记为未读");
    } else {
      preferences.readItems[key] = new Date().toISOString();
      renderContentChannel(item.channel);
      await persistContentPreferences(options.silent ? "" : "已标记为已读");
    }
    const contentState = getContentChannelState(item.channel);
    if (contentState.favoriteFilter === "read" || contentState.favoriteFilter === "unread") {
      await loadChannelContent(item.channel, { page: 1 });
      return;
    }
    renderContentChannel(item.channel);
  }

  async function hideContentSource(channel, sourceId) {
    if (!channel || !sourceId) {
      return;
    }
    const preferences = getContentPreferences();
    preferences.hiddenSources[`${channel}:${sourceId}`] = new Date().toISOString();
    await persistContentPreferences("该来源已隐藏");
    await Promise.all([
      loadChannelContent(channel, { page: 1 }),
      loadFeaturedContent(channel),
      refreshFavoriteHighlights(),
    ]);
  }

  async function unhideContentSource(channel, sourceId) {
    if (!channel || !sourceId) {
      return;
    }
    const preferences = getContentPreferences();
    delete preferences.hiddenSources[`${channel}:${sourceId}`];
    await persistContentPreferences("该来源已恢复显示");
    await Promise.all([
      openContentSourceModal(channel),
      loadChannelContent(channel, { page: 1 }),
      loadFeaturedContent(channel),
    ]);
  }

  async function openContentSourceModal(channel) {
    state.content.sourceModalChannel = channel;
    state.content.sourceEditingId = "";
    renderContentSourceModal();
    try {
      const payload = await fetchApiJson(`/api/content-sources?channel=${channel}`);
      state.content[channel].sources = Array.isArray(payload?.sources) ? payload.sources : [];
    } catch (error) {
      console.warn(`Failed to load ${channel} sources.`, error);
      if (isLocalDevelopment() && error?.message === "Request failed: 404") {
        state.content[channel].sources = [];
      }
    }
    renderContentSourceModal();
  }

  function closeContentSourceModal() {
    state.content.sourceModalChannel = "";
    state.content.sourceEditingId = "";
    renderContentSourceModal();
  }

  async function handleContentSourceSubmit(event) {
    if (event.target !== elements.contentSourceForm) {
      return;
    }
    event.preventDefault();
    const channel = elements.contentSourceForm.dataset.channel || state.content.sourceModalChannel;
    if (!channel) {
      return;
    }
    const formData = new FormData(elements.contentSourceForm);
    const sourceId = String(formData.get("sourceId") || "");
    const payload = {
      channel,
      name: String(formData.get("name") || "").trim(),
      type: String(formData.get("type") || "rss"),
      url: String(formData.get("url") || "").trim(),
      parserKey: String(formData.get("parserKey") || "").trim(),
      enabled: String(formData.get("enabled") || "true") === "true",
    };
    const path = sourceId ? `/api/content-sources/${sourceId}` : "/api/content-sources";
    const method = sourceId ? "PATCH" : "POST";
    try {
      await fetchApiJson(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      elements.contentSourceForm.reset();
      state.content.sourceEditingId = "";
      await Promise.all([
        openContentSourceModal(channel),
        loadChannelContent(channel),
        loadFeaturedContent(channel),
      ]);
      setSaveStatus("信源已保存", "success");
    } catch (error) {
      console.warn("Failed to save content source.", error);
      setSaveStatus(error?.message || "信源保存失败");
    }
  }

  async function ensureContentChannelLoaded(channel, options = {}) {
    if (!state.auth.user || !contentChannelIds.includes(channel)) {
      return;
    }
    const contentState = getContentChannelState(channel);
    if (!contentState.autoRefreshed) {
      await refreshChannelContentManually(channel, { silent: true, markAuto: true });
      return;
    }
    const jobs = [];
    if (options.refreshFeatured || (!contentState.featured.length && !contentState.loading)) {
      jobs.push(loadFeaturedContent(channel));
    }
    if (options.force || !contentState.loaded) {
      jobs.push(loadChannelContent(channel));
    }
    if (jobs.length) {
      await Promise.all(jobs);
    }
  }

  function queueContentSearch(channel, value) {
    const nextSearch = String(value || "").trim();
    window.clearTimeout(contentSearchDebounceTimer);
    contentSearchDebounceTimer = window.setTimeout(() => {
      void loadChannelContent(channel, {
        page: 1,
        search: nextSearch,
      });
    }, 220);
  }

  async function deleteContentSource(channel, sourceId) {
    try {
      await fetchApiJson(`/api/content-sources/${sourceId}`, { method: "DELETE" });
      await Promise.all([openContentSourceModal(channel), loadChannelContent(channel), loadFeaturedContent(channel)]);
      setSaveStatus("信源已删除", "success");
    } catch (error) {
      console.warn("Failed to delete content source.", error);
      setSaveStatus(error?.message || "删除信源失败");
    }
  }

  function getContentChannelFromControl(control) {
    for (const channel of contentChannelIds) {
      const channelElements = getContentElements(channel);
      if (
        control === channelElements?.search ||
        control === channelElements?.tagFilter ||
        control === channelElements?.sourceFilter ||
        control === channelElements?.favoriteFilter ||
        control === channelElements?.sortFilter
      ) {
        return channel;
      }
    }
    return "";
  }

  function handleContentToolbarInput(event) {
    const channel = getContentChannelFromControl(event.target);
    if (!channel || event.target.type !== "search") {
      return;
    }
    queueContentSearch(channel, event.target.value);
  }

  function handleContentToolbarChange(event) {
    const channel = getContentChannelFromControl(event.target);
    if (!channel || event.target.type === "search") {
      return;
    }
    const channelElements = getContentElements(channel);
    void loadChannelContent(channel, {
      page: 1,
      tag: channelElements.tagFilter.value,
      sourceId: channelElements.sourceFilter.value,
      favorite: channelElements.favoriteFilter.value,
      sort: channelElements.sortFilter.value,
    });
  }

  function handleContentClick(event) {
    const sourceCloseTarget = event.target.closest("[data-content-source-modal-close]");
    if (sourceCloseTarget) {
      closeContentSourceModal();
      return;
    }

    const refreshTarget = event.target.closest("[data-content-refresh]");
    if (refreshTarget) {
      void refreshChannelContentManually(refreshTarget.dataset.contentRefresh || "");
      return;
    }

    const openSourcesTarget = event.target.closest("[data-content-open-sources]");
    if (openSourcesTarget) {
      void openContentSourceModal(openSourcesTarget.dataset.contentOpenSources || "");
      return;
    }

    const pageTarget = event.target.closest("[data-content-page]");
    if (pageTarget) {
      const [channel, pageValue] = String(pageTarget.dataset.contentPage || "").split(":");
      const page = Number(pageValue);
      if (contentChannelIds.includes(channel) && Number.isFinite(page) && page > 0) {
        scrollContentChannelToTop(channel);
        void loadChannelContent(channel, { page });
      }
      return;
    }

    const sourceEditTarget = event.target.closest("[data-content-source-edit]");
    if (sourceEditTarget && state.content.sourceModalChannel) {
      state.content.sourceEditingId = sourceEditTarget.dataset.contentSourceEdit || "";
      renderContentSourceModal();
      return;
    }

    const sourceDeleteTarget = event.target.closest("[data-content-source-delete]");
    if (sourceDeleteTarget && state.content.sourceModalChannel) {
      const sourceId = sourceDeleteTarget.dataset.contentSourceDelete || "";
      if (sourceId && window.confirm("确认删除这个信源吗？")) {
        void deleteContentSource(state.content.sourceModalChannel, sourceId);
      }
      return;
    }

    const sourceUnhideTarget = event.target.closest("[data-content-source-unhide]");
    if (sourceUnhideTarget && state.content.sourceModalChannel) {
      void unhideContentSource(
        state.content.sourceModalChannel,
        sourceUnhideTarget.dataset.contentSourceUnhide || "",
      );
      return;
    }

    const sourceHideTarget = event.target.closest("[data-content-source-hide]");
    if (sourceHideTarget && state.content.sourceModalChannel) {
      void hideContentSource(
        state.content.sourceModalChannel,
        sourceHideTarget.dataset.contentSourceHide || "",
      );
      return;
    }

    const favoriteTarget = event.target.closest("[data-content-favorite]");
    if (favoriteTarget) {
      void toggleContentFavorite(favoriteTarget.dataset.contentFavorite || "");
      return;
    }

    const readToggleTarget = event.target.closest("[data-content-read-toggle]");
    if (readToggleTarget) {
      void toggleContentRead(readToggleTarget.dataset.contentReadToggle || "");
      return;
    }

    const linkTarget = event.target.closest("[data-content-open-link]");
    if (linkTarget) {
      const link = String(linkTarget.dataset.contentOpenLink || "").trim();
      if (link) {
        void toggleContentRead(linkTarget.dataset.contentItemId || "", { silent: true });
        if (linkTarget.tagName !== "A") {
          event.preventDefault();
          window.open(link, "_blank", "noopener,noreferrer");
        }
      }
      return;
    }

    const favoritesJump = event.target.closest("[data-favorites-jump]");
    if (favoritesJump) {
      const channel = favoritesJump.dataset.favoritesJump || contentChannelIds[0] || "finance";
      if (contentChannelIds.includes(channel)) {
        state.activeAppTab = channel;
        renderTopTabs();
        scrollContentChannelToTop(channel);
        void loadChannelContent(channel, {
          page: 1,
          favorite: "favorites",
        });
      }
    }
  }

  return {
    getContentElements,
    getContentChannelState,
    scrollContentChannelToTop,
    renderFeeds,
    renderContentStreams,
    renderContentChannel,
    renderContentSourceModal,
    loadFeaturedContent,
    refreshFavoriteHighlights,
    loadChannelContent,
    refreshChannelContentManually,
    prefetchContentFeedsOnSessionStart,
    toggleContentFavorite,
    openContentSourceModal,
    closeContentSourceModal,
    handleContentSourceSubmit,
    ensureContentChannelLoaded,
    queueContentSearch,
    deleteContentSource,
    getContentChannelFromControl,
    handleContentToolbarInput,
    handleContentToolbarChange,
    handleContentClick,
  };
}
