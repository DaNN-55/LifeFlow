<script setup>
defineProps({
  favorites: {
    type: Object,
    required: true,
  },
  formatDateTime: {
    type: Function,
    required: true,
  },
});

const emit = defineEmits(["jump", "configure"]);
</script>

<template>
  <section class="rail-card widget-card" aria-labelledby="favorites-title">
    <div class="section-head">
      <h2 id="favorites-title">Favorites</h2>
      <button type="button" class="icon-button" aria-label="打开收藏组件设置" @click="emit('configure')">
        <span class="material-symbols-outlined">settings</span>
      </button>
    </div>

    <div class="widget-display">
      <div v-if="favorites.items.length" class="favorites-widget-list">
        <article v-for="item in favorites.items" :key="item.id" class="favorites-widget-item">
          <button type="button" class="favorites-widget-link" @click="emit('jump', item.channel)">
            <strong>{{ item.title }}</strong>
            <span class="feed-meta">
              {{ item.source_name || item.channel }} // {{ formatDateTime(item.published_at || item.favorited_at || item.created_at) }}
            </span>
          </button>
        </article>
      </div>
      <p v-else class="widget-status">{{ favorites.message || "当前还没有收藏资讯。" }}</p>
    </div>
  </section>
</template>
