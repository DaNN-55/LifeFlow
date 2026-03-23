<script setup>
import { RouterLink } from "vue-router";

defineProps({
  title: { type: String, required: true },
  kicker: { type: String, required: true },
  icon: { type: String, required: true },
  channel: { type: String, required: true },
  items: { type: Array, default: () => [] },
  formatDateTime: { type: Function, required: true },
});

</script>

<template>
  <section class="rail-card feed-card" :aria-labelledby="`${channel}-feed-title`">
    <div class="section-head">
      <div>
        <p class="panel-kicker">{{ kicker }}</p>
        <h2 :id="`${channel}-feed-title`">{{ title }}</h2>
      </div>
      <span class="material-symbols-outlined section-icon">{{ icon }}</span>
    </div>

    <div class="feed-list">
      <article v-for="item in items" :key="item.id" class="feed-item">
        <h3>
          <a :href="item.canonical_url || item.source_url || '#'" target="_blank" rel="noreferrer">
            {{ item.title }}
          </a>
        </h3>
        <div class="feed-meta-stack">
          <p class="feed-meta">{{ item.source_name || "未知来源" }}</p>
          <p class="feed-meta">{{ formatDateTime(item.published_at || item.fetched_at) }}</p>
        </div>
      </article>
      <div v-if="items.length === 0" class="content-empty-state">加载中...</div>
    </div>

    <RouterLink class="show-more" :to="`/content/${channel}`">
      <span>Show More</span>
      <span class="material-symbols-outlined">expand_more</span>
    </RouterLink>
  </section>
</template>
