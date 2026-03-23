<script setup>
import { computed, onMounted, ref, watch } from "vue";

import ToolbarSelect from "../components/common/ToolbarSelect.vue";
import ContentCard from "../components/content/ContentCard.vue";
import ContentPreviewModal from "../components/content/ContentPreviewModal.vue";
import ContentSourceDialog from "../components/content/ContentSourceDialog.vue";
import { contentTabs } from "../app/constants";
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
const previewItem = ref(null);

const isAuthenticated = computed(() => Boolean(sessionStore.user?.id));
const isLocalMode = computed(() => contentState.value?.mode === "local");
const showSourceControls = computed(() => isLocalMode.value || isAuthenticated.value);
const importInputRef = ref(null);
const channelConfig = computed(
  () => contentTabs.find((tab) => tab.id === props.channel) || { label: props.channel, kicker: "Content" },
);
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

function openLocalCacheImport() {
  importInputRef.value?.click();
}

async function handleLocalCacheImport(event) {
  const file = event.target?.files?.[0];
  if (!file) {
    return;
  }
  await contentStore.importLocalCache(file, props.channel);
  event.target.value = "";
}

function openPreview(item) {
  previewItem.value = item || null;
}

function closePreview() {
  previewItem.value = null;
}

async function loadContentChannel() {
  await contentStore.loadChannel(props.channel);
}

onMounted(loadContentChannel);
watch(
  () => props.channel,
  async () => {
    closePreview();
    await loadContentChannel();
  },
);
watch(
  () => sessionStore.user?.id,
  async () => {
    closePreview();
    await loadContentChannel();
  },
);
</script>

<template>
  <section class="stage-view content-stream-view">
    <section class="content-panel is-active">
      <div class="panel-header">
        <div>
          <p class="panel-kicker">{{ channelConfig.kicker }}</p>
          <h1>{{ channelConfig.label }}</h1>
        </div>
        <div class="content-stream-actions">
          <button v-if="showSourceControls" type="button" class="task-cancel-action" @click="contentStore.openSourceModal(channel)">
            管理信源
          </button>
          <button type="button" class="settings-save" @click="contentStore.refreshChannel(channel)">
            {{ isAuthenticated ? "刷新资讯" : "刷新本地缓存" }}
          </button>
        </div>
      </div>

      <div class="content-stream-shell">
        <div class="content-stream-meta" :data-tone="getContentMetaTone(contentState)">
          {{ contentStore.getMetaText(channel) }}
        </div>

        <div v-if="isLocalMode" class="local-mode-strip">
          <p class="local-mode-copy">
            未登录时已切到本地模式，你可以直接用本地缓存测试这三个内容频道，筛选状态也会保留在本地。
            当前页已读 {{ readCount }} / {{ contentState.items.length }}。
          </p>
          <div class="local-mode-actions">
            <button type="button" class="task-cancel-action" @click="contentStore.exportLocalCache()">导出本地缓存</button>
            <button type="button" class="task-cancel-action" @click="openLocalCacheImport">导入本地缓存</button>
            <button type="button" class="task-cancel-action" @click="contentStore.markCurrentPageAsRead(channel)">本页标记已读</button>
            <button type="button" class="task-cancel-action" @click="contentStore.clearLocalChannelMarks(channel)">清空本地标记</button>
            <button type="button" class="task-cancel-action" @click="contentStore.resetLocalChannelCache(channel)">重置频道缓存</button>
          </div>
        </div>

        <input
          ref="importInputRef"
          class="visually-hidden"
          type="file"
          accept="application/json"
          @change="handleLocalCacheImport"
        />

        <div v-if="isLocalMode && contentStore.localModeFeedback?.message" class="content-local-feedback" :data-tone="contentStore.localModeFeedback.tone || 'default'">
          {{ contentStore.localModeFeedback.message }}
        </div>

        <div v-if="hasFilters" class="content-quick-strip">
          <button type="button" class="task-cancel-action" @click="resetFilters">清空筛选</button>
        </div>

        <div class="content-toolbar toolbar-filter-bar">
          <label class="content-toolbar-field">
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

          <label class="content-toolbar-field">
            <span class="weekly-filter-label">标签</span>
            <ToolbarSelect
              :model-value="contentState.tag"
              icon="sell"
              :options="tagOptions"
              @update:model-value="contentStore.loadChannel(channel, { tag: $event, page: 1 })"
            />
          </label>

          <label class="content-toolbar-field">
            <span class="weekly-filter-label">来源</span>
            <ToolbarSelect
              :model-value="contentState.sourceId"
              icon="public"
              :options="sourceOptions"
              @update:model-value="contentStore.loadChannel(channel, { sourceId: $event, page: 1 })"
            />
          </label>

          <label class="content-toolbar-field">
            <span class="weekly-filter-label">范围</span>
            <ToolbarSelect
              :model-value="contentState.favoriteFilter"
              icon="filter_alt"
              :options="favoriteOptions"
              @update:model-value="contentStore.loadChannel(channel, { favoriteFilter: $event, page: 1 })"
            />
          </label>

          <label class="content-toolbar-field">
            <span class="weekly-filter-label">排序</span>
            <ToolbarSelect
              :model-value="contentState.sort"
              icon="sort"
              :options="sortOptions"
              @update:model-value="contentStore.loadChannel(channel, { sort: $event, page: 1 })"
            />
          </label>
        </div>

        <div v-if="contentState.loading && contentState.items.length === 0" class="content-empty-state">
          正在加载资讯...
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
            @toggle-preview="openPreview"
            @toggle-read="contentStore.toggleReadStatus"
            @open-link="contentStore.markAsRead"
          />
        </div>

        <div v-if="contentState.total > contentState.pageSize" class="content-pagination">
          <button
            type="button"
            class="task-cancel-action"
            :disabled="contentState.page <= 1"
            @click="contentStore.loadChannel(channel, { page: contentState.page - 1 })"
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
            @click="contentStore.loadChannel(channel, { page: contentState.page + 1 })"
          >
            下一页
          </button>
        </div>
      </div>
    </section>

    <ContentSourceDialog
      :open="contentStore.sourceModalChannel === channel"
      :title="`${channelConfig.label} 信源管理`"
      :sources="contentStore.getVisibleSources(channel)"
      :hidden-sources="contentStore.getHiddenSources(channel)"
      :failures="contentStore.currentSourceFailures"
      :feedback="contentStore.sourceFeedback"
      :form="sourceForm"
      @close="contentStore.closeSourceModal"
      @save-source="contentStore.saveSource"
      @edit-source="contentStore.startEditSource"
      @delete-source="contentStore.deleteSource"
      @hide-source="contentStore.hideSource"
      @unhide-source="contentStore.unhideSource"
      @toggle-source-enabled="contentStore.toggleSourceEnabled"
      @restore-defaults="contentStore.restoreDefaultSources"
      @update:form="sourceForm = $event"
    />

    <ContentPreviewModal
      :open="Boolean(previewItem)"
      :item="previewItem"
      :is-read="previewItem ? contentStore.isItemRead(previewItem) : false"
      :published-at="previewItem ? contentStore.getPublishedAt(previewItem) : ''"
      @close="closePreview"
      @toggle-favorite="contentStore.toggleFavorite"
      @toggle-read="contentStore.toggleReadStatus"
      @open-link="contentStore.markAsRead"
    />
  </section>
</template>
