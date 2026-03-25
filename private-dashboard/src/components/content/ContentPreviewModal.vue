<script setup>
import { computed } from "vue";

import SettingsModal from "../account/SettingsModal.vue";
import { getContentCardExcerpt, getContentTagTone, getSafeContentLink } from "../../utils/content";
import { renderContentPreviewMarkdown } from "../../utils/markdown";

const props = defineProps({
  open: { type: Boolean, default: false },
  item: { type: Object, default: null },
  isRead: { type: Boolean, default: false },
  publishedAt: { type: String, default: "" },
});

const emit = defineEmits(["close", "toggle-favorite", "toggle-read", "open-link"]);

const previewHtml = computed(() => {
  const body = props.item?.body_zh || props.item?.body_raw || props.item?.summary_zh || props.item?.summary_raw || "";
  return renderContentPreviewMarkdown(body);
});

const safeLink = computed(() => getSafeContentLink(props.item));
</script>

<template>
  <SettingsModal :open="open" :title="item?.title || '内容预览'" @close="emit('close')">
    <div v-if="item" class="content-preview-shell">
      <div class="content-preview-header">
        <p class="content-preview-kicker">{{ item.channel || "content" }}</p>
        <div class="content-preview-meta">
          <span>{{ item.source_name || "未知来源" }}</span>
          <span>{{ publishedAt }}</span>
        </div>
      </div>

      <p class="content-preview-excerpt">{{ getContentCardExcerpt(item) }}</p>

      <div class="content-preview-actions">
        <button type="button" class="content-read-toggle" :class="{ 'is-active': isRead }" @click="emit('toggle-read', item)">
          {{ isRead ? "标记未读" : "标记已读" }}
        </button>
        <button
          type="button"
          class="content-favorite-button"
          :class="{ 'is-active': item.is_favorite }"
          @click="emit('toggle-favorite', item)"
        >
          <svg class="content-favorite-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M12 3.85 14.52 8.95 20.15 9.77 16.08 13.74 17.04 19.35 12 16.7 6.96 19.35 7.92 13.74 3.85 9.77 9.48 8.95 12 3.85Z" />
          </svg>
        </button>
        <a
          v-if="safeLink"
          :href="safeLink"
          target="_blank"
          rel="noreferrer"
          class="settings-save content-preview-link"
          @click="emit('open-link', item)"
        >
          打开原文
        </a>
      </div>

      <div class="content-card-tags content-preview-tags">
        <span
          v-for="tag in (Array.isArray(item.tags) && item.tags.length ? item.tags : ['资讯'])"
          :key="tag"
          class="content-tag"
          :class="`is-${getContentTagTone(tag, item.channel)}`"
        >
          {{ tag }}
        </span>
      </div>

      <div class="content-preview-body" v-html="previewHtml || '<p>暂无正文。</p>'"></div>
    </div>
  </SettingsModal>
</template>
