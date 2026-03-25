<script setup>
defineProps({
  github: {
    type: Object,
    required: true,
  },
  profileUrl: {
    type: String,
    default: "",
  },
  formatDateTime: {
    type: Function,
    required: true,
  },
});

</script>

<template>
  <section class="rail-card widget-card github-card" aria-labelledby="github-card-title">
    <div class="section-head">
      <div>
        <p class="panel-kicker">Project preview</p>
        <h2 id="github-card-title">GitHub</h2>
      </div>
      <a
        class="icon-button github-open-button"
        :href="profileUrl || 'https://github.com/DanN-55'"
        target="_blank"
        rel="noreferrer"
        :aria-disabled="!profileUrl"
        aria-label="打开 GitHub 主页"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" class="github-logo">
          <path
            d="M12 2C6.477 2 2 6.484 2 12.017c0 4.426 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.866-.013-1.7-2.782.605-3.369-1.344-3.369-1.344-.455-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.004.071 1.532 1.032 1.532 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.027A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.297 2.748-1.027 2.748-1.027.546 1.378.202 2.397.1 2.65.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.748 0 .268.18.58.688.481A10.019 10.019 0 0 0 22 12.017C22 6.484 17.523 2 12 2Z"
            fill="currentColor"
          />
        </svg>
      </a>
    </div>

    <div class="widget-display">
      <form v-if="!profileUrl" class="github-profile-form">
        <p class="settings-copy">当前未配置 GitHub 主页网址，后续接账号设置时再补可编辑入口。</p>
      </form>

      <div v-else class="github-stream">
        <article v-for="repo in github.repos" :key="repo.url" class="github-repo-item">
          <div class="github-repo-copy">
            <h3>{{ repo.name }}</h3>
            <p>{{ repo.description || "暂无仓库简介。" }}</p>
          </div>
          <div class="github-repo-meta">
            <span class="feed-meta">
              {{ repo.updatedAt ? `Updated ${formatDateTime(repo.updatedAt)}` : github.message || "Recently active" }}
            </span>
            <a class="show-more github-inline-link" :href="repo.url" target="_blank" rel="noreferrer">
              <span>{{ repo.shortUrl || "Open Repo" }}</span>
              <span class="material-symbols-outlined">arrow_outward</span>
            </a>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>
