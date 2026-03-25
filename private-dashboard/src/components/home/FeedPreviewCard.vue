<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";

const props = defineProps({
  title: { type: String, required: true },
  kicker: { type: String, required: true },
  icon: { type: String, required: true },
  channel: { type: String, required: true },
  linkTo: { type: String, default: "" },
  items: { type: Array, default: () => [] },
  emptyText: { type: String, default: "暂无资讯" },
  formatDateTime: { type: Function, required: true },
});

const cardId = computed(() => `${props.channel}-feed-title`);
const targetPath = computed(() => props.linkTo || `/content/${props.channel}`);
</script>

<template>
  <section class="rail-card feed-card" :aria-labelledby="cardId">
    <div class="section-head">
      <div>
        <p class="panel-kicker">{{ kicker }}</p>
        <h2 :id="cardId">{{ title }}</h2>
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
      <div v-if="items.length === 0" class="content-empty-state">{{ emptyText }}</div>
    </div>

    <RouterLink class="show-more" :to="targetPath">
      <span>Show More</span>
      <span class="material-symbols-outlined">expand_more</span>
    </RouterLink>
  </section>
</template>
