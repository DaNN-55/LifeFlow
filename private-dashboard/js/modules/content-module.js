import { buildMockContent, getMockContentPayload } from "./content-mocks.js";
import {
  getContentCardExcerpt,
  getContentMetaText,
  getSafeContentLink,
} from "./content-helpers.js";

export function createContentModule(deps) {
  const {
    state,
    elements,
    escapeHtml,
    escapeAttribute,
    formatDateTime,
    fetchApiJson,
    isLocalDevelopment,
    getSidebarPreferences,
    renderTopTabs,
    renderWidgets,
    setSaveStatus,
  } = deps;
  let contentSearchDebounceTimer = null;

  function getContentElements(channel) {
    if (channel === "finance") {
      return {
        search: elements.financeSearch,
        tagFilter: elements.financeTagFilter,
        sourceFilter: elements.financeSourceFilter,
        favoriteFilter: elements.financeFavoriteFilter,
        sortFilter: elements.financeSortFilter,
        meta: elements.financeContentMeta,
        grid: elements.financeContentGrid,
        pagination: elements.financeContentPagination,
      };
    }
    return {
      search: elements.scienceSearch,
      tagFilter: elements.scienceTagFilter,
      sourceFilter: elements.scienceSourceFilter,
      favoriteFilter: elements.scienceFavoriteFilter,
      sortFilter: elements.scienceSortFilter,
      meta: elements.scienceContentMeta,
      grid: elements.scienceContentGrid,
      pagination: elements.scienceContentPagination,
    };
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
    renderFeedInto(elements.financeFeed, state.content.finance.featured, "finance");
    renderFeedInto(elements.scienceFeed, state.content.science.featured, "science");
  }

  function getContentChannelState(channel) {
    return channel === "science" ? state.content.science : state.content.finance;
  }

  function scrollContentChannelToTop(channel) {
    const view = channel === "science" ? elements.scienceView : elements.financeView;
    const shell = view?.querySelector(".content-stream-shell");
    if (!shell) {
      return;
    }
    shell.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderContentChannel(channel) {
    const contentState = state.content[channel];
    const channelElements = getContentElements(channel);
    if (!channelElements.grid) {
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
      : getContentMetaText(contentState, formatDateTime);
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
        (item) => `
          <article class="content-card ${item.is_favorite ? "is-favorited" : ""}">
            <div class="content-card-main">
              <h3>${escapeHtml(item.title)}</h3>
              <p>${escapeHtml(getContentCardExcerpt(item))}</p>
              <div class="content-card-footer">
                <span>${escapeHtml(item.source_name || "未知来源")}</span>
                <span>${escapeHtml(item.author || "未知作者")}</span>
                <span>${escapeHtml(formatDateTime(item.published_at || item.fetched_at))}</span>
              </div>
            </div>
            <div class="content-card-side">
              ${
                Array.isArray(item.tags) && item.tags.length
                  ? `<div class="content-card-tags">${item.tags
                      .slice(0, 4)
                      .map((tag) => `<span class="content-tag">${escapeHtml(tag)}</span>`)
                      .join("")}</div>`
                  : '<div class="content-card-tags"><span class="content-tag">资讯</span></div>'
              }
              <div class="content-card-actions">
                <button
                  type="button"
                  class="content-favorite-button ${item.is_favorite ? "is-active" : ""}"
                  data-content-favorite="${escapeAttribute(item.id)}"
                  aria-label="${item.is_favorite ? "取消收藏" : "收藏资讯"}"
                >
                  ${item.is_favorite ? "取消收藏" : "收藏"}
                </button>
                ${
                  getSafeContentLink(item)
                    ? `<button
                        type="button"
                        class="content-link-inline"
                        data-content-open-link="${escapeAttribute(getSafeContentLink(item))}"
                      >
                        查看原文
                      </button>`
                    : ""
                }
              </div>
            </div>
          </article>
        `,
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
    renderContentChannel("finance");
    renderContentChannel("science");
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
    const channelLabel = channel === "science" ? "Science" : "Finance";
    elements.contentSourceTitle.textContent = `${channelLabel} 信源管理`;
    const sources = state.content[channel].sources || [];
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
    elements.contentSourceList.innerHTML = sources.length
      ? sources
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
      : '<div class="content-empty-state">当前没有可用信源。</div>';
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
      const [financePayload, sciencePayload] = await Promise.all([
        fetchApiJson("/api/content?channel=finance&page=1&pageSize=3&favorite=favorites&sort=latest"),
        fetchApiJson("/api/content?channel=science&page=1&pageSize=3&favorite=favorites&sort=latest"),
      ]);
      const merged = [...(financePayload?.items || []), ...(sciencePayload?.items || [])]
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
      const params = new URLSearchParams({
        channel,
        page: String(contentState.page),
        pageSize: String(contentState.pageSize),
        sort: contentState.sort,
      });
      if (contentState.search) params.set("q", contentState.search);
      if (contentState.tag !== "all") params.set("tag", contentState.tag);
      if (contentState.sourceId !== "all") params.set("sourceId", contentState.sourceId);
      if (contentState.favoriteFilter !== "all") params.set("favorite", contentState.favoriteFilter);
      const payload = await fetchApiJson(`/api/content?${params.toString()}`);
      contentState.items = Array.isArray(payload?.items) ? payload.items : [];
      contentState.total = Number(payload?.total || 0);
      contentState.page = Number(payload?.page || contentState.page);
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
    await Promise.all([
      refreshChannelContentManually("finance", { silent: true, markAuto: true, featuredOnly: true }),
      refreshChannelContentManually("science", { silent: true, markAuto: true, featuredOnly: true }),
    ]);
  }

  function findLocalContentItem(itemId) {
    return [
      ...state.content.finance.items,
      ...state.content.finance.featured,
      ...state.content.science.items,
      ...state.content.science.featured,
    ].find((item) => item.id === itemId);
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
    if (!state.auth.user || !["finance", "science"].includes(channel)) {
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
    if (
      control === elements.financeSearch ||
      control === elements.financeTagFilter ||
      control === elements.financeSourceFilter ||
      control === elements.financeFavoriteFilter ||
      control === elements.financeSortFilter
    ) {
      return "finance";
    }
    if (
      control === elements.scienceSearch ||
      control === elements.scienceTagFilter ||
      control === elements.scienceSourceFilter ||
      control === elements.scienceFavoriteFilter ||
      control === elements.scienceSortFilter
    ) {
      return "science";
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
      if (["finance", "science"].includes(channel) && Number.isFinite(page) && page > 0) {
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

    const favoriteTarget = event.target.closest("[data-content-favorite]");
    if (favoriteTarget) {
      void toggleContentFavorite(favoriteTarget.dataset.contentFavorite || "");
      return;
    }

    const linkTarget = event.target.closest("[data-content-open-link]");
    if (linkTarget) {
      const link = String(linkTarget.dataset.contentOpenLink || "").trim();
      if (link) {
        window.open(link, "_blank", "noopener,noreferrer");
      }
      return;
    }

    const favoritesJump = event.target.closest("[data-favorites-jump]");
    if (favoritesJump) {
      const channel = favoritesJump.dataset.favoritesJump || "finance";
      if (channel === "finance" || channel === "science") {
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
