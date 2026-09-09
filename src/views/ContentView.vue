<script setup>
import { computed, nextTick, ref } from "vue";

import ToolbarSelect from "../components/common/ToolbarSelect.vue";
import ContentCard from "../components/content/ContentCard.vue";
import ContentSourceDialog from "../components/content/ContentSourceDialog.vue";
import TaskDialog from "../components/today/TaskDialog.vue";
import { useContentStore } from "../stores/content";
import { useSessionStore } from "../stores/session";
import { getContentMetaTone } from "../utils/content";

const props = defineProps({
  channel: {
    type: String,
    required: true,
  },
});

const sessionStore = useSessionStore();
const contentStore = useContentStore();

const isAuthenticated = computed(() => Boolean(sessionStore.user?.id));
const isDemoMode = computed(() => contentState.value?.mode === "demo");
const confirmDialog = ref({
  type: "",
  sourceId: "",
});
const contentState = computed(() => contentStore.getChannelState(props.channel));
const sourceForm = computed({
  get: () => contentStore.sourceForm,
  set: (value) => contentStore.setSourceForm(value),
});

const tagOptions = computed(() => [
  { value: "all", label: "全部标签" },
  ...(contentState.value?.tags || []).map((tag) => ({ value: tag, label: tag })),
]);

const sourceOptions = computed(() => [
  { value: "all", label: "全部来源" },
  ...(contentStore.getVisibleSources(props.channel) || []).map((source) => ({ value: source.id, label: source.name })),
]);

const favoriteOptions = computed(() => [
  { value: "all", label: "全部资讯" },
  { value: "favorites", label: "收藏资讯" },
  { value: "unread", label: "未读资讯" },
  { value: "read", label: "已读资讯" },
]);

const sortOptions = computed(() => [
  { value: "latest", label: "最新优先" },
  { value: "oldest", label: "最早优先" },
]);

const hasFilters = computed(
  () =>
    Boolean(contentState.value?.search) ||
    contentState.value?.tag !== "all" ||
    contentState.value?.sourceId !== "all" ||
    contentState.value?.favoriteFilter !== "all" ||
    contentState.value?.sort !== "latest",
);

const confirmDialogTitle = computed(() => {
  if (confirmDialog.value.type === "delete-source") {
    return "删除信源";
  }
  return "";
});

const confirmDialogCopy = computed(() => {
  if (confirmDialog.value.type === "delete-source") {
    const source = getSourceById(confirmDialog.value.sourceId);
    return source ? `确认删除信源 ${source.name} 吗？` : "确认删除这个信源吗？";
  }
  return "";
});

const confirmDialogLabel = computed(() => {
  if (confirmDialog.value.type === "delete-source") {
    return "确认删除";
  }
  return "确认";
});

const readCount = computed(() => {
  const items = Array.isArray(contentState.value?.items) ? contentState.value.items : [];
  return items.filter((item) => contentStore.isItemRead(item)).length;
});

async function resetFilters() {
  await contentStore.loadChannel(props.channel, {
    page: 1,
    search: "",
    tag: "all",
    sourceId: "all",
    favoriteFilter: "all",
    sort: "latest",
  });
}

function getSourceById(sourceId) {
  if (!sourceId) {
    return null;
  }
  return [
    ...(contentStore.getVisibleSources(props.channel) || []),
    ...(contentStore.getHiddenSources(props.channel) || []),
  ].find((source) => source.id === sourceId) || null;
}

function openConfirmDialog(type, sourceId = "") {
  confirmDialog.value = {
    type,
    sourceId,
  };
}

function closeConfirmDialog() {
  confirmDialog.value = {
    type: "",
    sourceId: "",
  };
}

async function confirmDangerAction() {
  const { type, sourceId } = confirmDialog.value;
  if (type === "delete-source" && sourceId) {
    await contentStore.deleteSource(sourceId);
  }
  closeConfirmDialog();
}

async function scrollPageToTop() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  await nextTick();
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  if (document.scrollingElement) {
    document.scrollingElement.scrollTop = 0;
  }
}

async function loadChannelFromTop(overrides = {}) {
  await contentStore.loadChannel(props.channel, overrides);
  await scrollPageToTop();
}
</script>

<template>
  <section class="stage-view content-stream-view">
    <section class="content-panel is-active">
      <div class="panel-header">
        <div>
          <p class="panel-kicker">Unified reader</p>
          <h1>News</h1>
        </div>
      </div>

      <div class="content-stream-shell">
        <div class="save-note-row content-stage-row">
          <div class="content-stream-meta content-stage-meta" :data-tone="getContentMetaTone(contentState)">
            {{ contentStore.getMetaText(channel) }}
          </div>
          <button
            v-if="isAuthenticated && !isDemoMode"
            type="button"
            class="task-cancel-action"
            @click="contentStore.openSourceModal(channel)"
          >
            管理信源
          </button>
          <button
            v-if="!isDemoMode"
            type="button"
            class="content-stage-refresh"
            :class="{ 'is-spinning': contentState.refreshing }"
            :aria-label="isAuthenticated ? '刷新资讯' : '查看资讯需要登录'"
            :disabled="!isAuthenticated && !isDemoMode"
            @click="contentStore.refreshChannel(channel)"
          >
            <span class="material-symbols-outlined" aria-hidden="true">refresh</span>
          </button>
        </div>

        <div v-if="isDemoMode" class="local-mode-strip">
          <p class="local-mode-copy">
            当前为安全 Demo，资讯、收藏和已读状态均为合成数据，并保存在独立的本地空间；此处不连接、刷新或管理真实信源。
            当前页已读 {{ readCount }} / {{ contentState.items.length }}。
          </p>
        </div>

        <div v-if="hasFilters" class="content-quick-strip">
          <button type="button" class="task-cancel-action" @click="resetFilters">清空筛选</button>
        </div>

        <div class="weekly-review-controls content-toolbar toolbar-filter-bar">
          <label class="weekly-filter-field content-toolbar-field">
            <span class="weekly-filter-label">搜索</span>
            <div class="toolbar-control toolbar-search-control">
              <span class="material-symbols-outlined toolbar-control-icon" aria-hidden="true">search</span>
              <input
                :value="contentState.search"
                type="search"
                placeholder="搜索标题、摘要或来源..."
                @input="contentStore.loadChannel(channel, { search: $event.target.value, page: 1 })"
              />
            </div>
          </label>

          <label class="weekly-filter-field content-toolbar-field">
            <span class="weekly-filter-label">标签</span>
            <ToolbarSelect
              :model-value="contentState.tag"
              icon="sell"
              :options="tagOptions"
              @update:model-value="contentStore.loadChannel(channel, { tag: $event, page: 1 })"
            />
          </label>

          <label class="weekly-filter-field content-toolbar-field">
            <span class="weekly-filter-label">来源</span>
            <ToolbarSelect
              :model-value="contentState.sourceId"
              icon="public"
              :options="sourceOptions"
              @update:model-value="contentStore.loadChannel(channel, { sourceId: $event, page: 1 })"
            />
          </label>

          <label class="weekly-filter-field content-toolbar-field">
            <span class="weekly-filter-label">范围</span>
            <ToolbarSelect
              :model-value="contentState.favoriteFilter"
              icon="filter_alt"
              :options="favoriteOptions"
              @update:model-value="contentStore.loadChannel(channel, { favoriteFilter: $event, page: 1 })"
            />
          </label>

          <label class="weekly-filter-field content-toolbar-field">
            <span class="weekly-filter-label">排序</span>
            <ToolbarSelect
              :model-value="contentState.sort"
              icon="sort"
              :options="sortOptions"
              @update:model-value="contentStore.loadChannel(channel, { sort: $event, page: 1 })"
            />
          </label>
        </div>

        <div v-if="!isAuthenticated && !isDemoMode" class="content-empty-state">
          News 仅支持已登录账号或安全 Demo。
        </div>
        <div v-else-if="contentState.error && contentState.items.length === 0" class="content-empty-state">
          {{ contentState.error }}
        </div>
        <div v-else-if="contentState.items.length === 0" class="content-empty-state">
          暂无资讯，试试手动刷新或添加信源。
        </div>
        <div v-else class="content-masonry">
          <ContentCard
            v-for="item in contentState.items"
            :key="item.id"
            :item="item"
            :published-at="contentStore.getPublishedAt(item)"
            :is-read="contentStore.isItemRead(item)"
            @toggle-favorite="contentStore.toggleFavorite"
            @toggle-read="contentStore.toggleReadStatus"
            @open-link="contentStore.markAsRead"
          />
        </div>

        <div v-if="contentState.total > contentState.pageSize" class="content-pagination">
          <button
            type="button"
            class="task-cancel-action"
            :disabled="contentState.page <= 1"
            @click="loadChannelFromTop({ page: contentState.page - 1 })"
          >
            上一页
          </button>
          <span class="content-page-indicator">
            第 {{ contentState.page }} / {{ Math.max(1, Math.ceil(contentState.total / contentState.pageSize)) }} 页
          </span>
          <button
            type="button"
            class="task-cancel-action"
            :disabled="contentState.page >= Math.max(1, Math.ceil(contentState.total / contentState.pageSize))"
            @click="loadChannelFromTop({ page: contentState.page + 1 })"
          >
            下一页
          </button>
        </div>
      </div>
    </section>

    <ContentSourceDialog
      :open="contentStore.sourceModalChannel === channel"
      title="News 信源管理"
      :sources="contentStore.getVisibleSources(channel)"
      :hidden-sources="contentStore.getHiddenSources(channel)"
      :failures="contentStore.currentSourceFailures"
      :feedback="contentStore.sourceFeedback"
      :form="sourceForm"
      @close="contentStore.closeSourceModal"
      @save-source="contentStore.saveSource"
      @edit-source="contentStore.startEditSource"
      @delete-source="openConfirmDialog('delete-source', $event)"
      @hide-source="contentStore.hideSource"
      @unhide-source="contentStore.unhideSource"
      @toggle-source-enabled="contentStore.toggleSourceEnabled"
      @update:form="sourceForm = $event"
    />

    <TaskDialog
      :open="Boolean(confirmDialog.type)"
      :title="confirmDialogTitle"
      :copy="confirmDialogCopy"
      :confirm-label="confirmDialogLabel"
      tone="danger"
      @cancel="closeConfirmDialog"
      @confirm="confirmDangerAction"
    />
  </section>
</template>
