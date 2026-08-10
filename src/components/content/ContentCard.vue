<script setup>
import {
  getContentCardExcerpt,
  getContentSourceIconUrl,
  getContentTagTone,
  getContentThumbnailUrl,
  getSafeContentLink,
  normalizeContentTagList,
} from "../../utils/content";

defineProps({
  item: {
    type: Object,
    required: true,
  },
  publishedAt: {
    type: String,
    default: "",
  },
  isRead: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["toggle-favorite", "toggle-read", "open-link"]);

function handleImageError(event) {
  const target = event.target;
  if (!(target instanceof HTMLImageElement)) {
    return;
  }
  target.hidden = true;
  const thumb = target.closest(".content-card-thumb");
  if (thumb) {
    thumb.classList.remove("has-image");
  }
}
</script>

<template>
  <article class="content-card" :class="{ 'is-favorited': item.is_favorite, 'is-read': isRead }">
    <div class="content-card-thumb" :class="{ 'has-image': getContentThumbnailUrl(item) }" aria-hidden="true">
      <img
        v-if="getContentThumbnailUrl(item)"
        :src="getContentThumbnailUrl(item)"
        alt=""
        loading="lazy"
        referrerpolicy="no-referrer"
        @error="handleImageError"
      />
    </div>

    <div class="content-card-body">
      <div class="content-card-main">
        <h3>
          <a
            v-if="getSafeContentLink(item)"
            :href="getSafeContentLink(item)"
            target="_blank"
            rel="noreferrer"
            class="content-title-link"
            @click="emit('open-link', item)"
          >
            {{ item.title }}
          </a>
          <span v-else>{{ item.title }}</span>
        </h3>
        <p class="content-card-summary">{{ getContentCardExcerpt(item) }}</p>
        <div class="content-card-meta-row">
          <div class="content-card-meta">
            <span class="content-card-source">
              <img
                v-if="getContentSourceIconUrl(item)"
                class="content-source-icon"
                :src="getContentSourceIconUrl(item)"
                alt=""
                loading="lazy"
                referrerpolicy="no-referrer"
                @error="$event.target.hidden = true"
              />
              <span>{{ item.source_name || "未知来源" }}</span>
            </span>
            <span>{{ publishedAt }}</span>
          </div>
        </div>
      </div>

      <div class="content-card-footer">
        <div class="content-card-tags">
          <span
            v-for="tag in (normalizeContentTagList(item.tags).length ? normalizeContentTagList(item.tags).slice(0, 4) : ['资讯'])"
            :key="tag"
            class="content-tag"
            :class="`is-${getContentTagTone(tag, item.channel)}`"
          >
            {{ tag }}
          </span>
        </div>

        <div class="content-card-actions">
          <button
            type="button"
            class="task-cancel-action"
            @click="emit('toggle-read', item)"
          >
            {{ isRead ? "标记未读" : "标记已读" }}
          </button>
          <button
            type="button"
            class="content-favorite-button"
            :class="{ 'is-active': item.is_favorite }"
            :aria-label="item.is_favorite ? '取消收藏' : '收藏资讯'"
            :title="item.is_favorite ? '取消收藏' : '收藏资讯'"
            @click="emit('toggle-favorite', item)"
          >
            <svg class="content-favorite-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M12 3.85 14.52 8.95 20.15 9.77 16.08 13.74 17.04 19.35 12 16.7 6.96 19.35 7.92 13.74 3.85 9.77 9.48 8.95 12 3.85Z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </article>
</template>
