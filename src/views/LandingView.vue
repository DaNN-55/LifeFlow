<script setup>
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";

import { alphaAnalytics } from "../services/alpha-analytics.js";
import "../styles/landing.css";

const workflowSteps = [
  {
    number: "01",
    moment: "今天",
    title: "把今天要做的事放在眼前",
    description: "打开 Today，只看今天的任务，不用在几个清单之间来回找。",
    proof: "Today",
  },
  {
    number: "02",
    moment: "做完后",
    title: "顺手记下刚才发生了什么",
    description: "遇到了什么、为什么这样处理，就记在当天。复盘时不用重新回忆。",
    proof: "执行备注",
  },
  {
    number: "03",
    moment: "周末",
    title: "看看这一周到底做了什么",
    description: "完成的任务、没做完的事和留下的备注，都会出现在周复盘里。",
    proof: "周复盘",
  },
];

const productTourItems = [
  {
    id: "today",
    label: "Today",
    title: "安排任务，随手记下进展",
    detail: "当天的任务、完成状态和执行备注都放在同一个页面。",
  },
  {
    id: "news",
    label: "News",
    title: "阅读资讯，留下真正有用的内容",
    detail: "按来源和标签筛选资讯，读完可以标记或收藏。",
  },
  {
    id: "review",
    label: "周复盘",
    title: "按周查看任务和执行记录",
    detail: "完成次数、任务备注和周总结会按时间汇总。",
  },
];

const frequentlyAskedQuestions = [
  {
    question: "Demo 会改动我的账号吗？",
    answer: "不会。Demo 只使用示例任务和资讯，不会连接 Supabase、真实信源或你的账号。",
  },
  {
    question: "Demo 里的内容会保存吗？",
    answer: "完整 Demo 的内容会留在当前浏览器里。你可以随时重置；上方的小 Demo 刷新页面后就会恢复原样。",
  },
  {
    question: "现在能注册账号吗？",
    answer: "暂时不能。已有 Alpha 账号可以继续登录，第一次来可以先用 Demo。",
  },
];

const activeProductTour = ref(productTourItems[0].id);
const activeProductTourItem = computed(() => productTourItems.find((item) => item.id === activeProductTour.value));

function selectProductTour(id) {
  activeProductTour.value = id;
}

function moveProductTour(event, index, offset) {
  const tabs = [...event.currentTarget.closest('[role="tablist"]').querySelectorAll('[role="tab"]')];
  const nextIndex = (index + offset + tabs.length) % tabs.length;
  activeProductTour.value = productTourItems[nextIndex].id;
  tabs[nextIndex].focus();
}

function jumpProductTour(event, index) {
  const tabs = [...event.currentTarget.closest('[role="tablist"]').querySelectorAll('[role="tab"]')];
  activeProductTour.value = productTourItems[index].id;
  tabs[index].focus();
}

const GITHUB_REPOSITORY_URL = "https://github.com/DaNN-55/LifeFlow";
const GITHUB_ISSUE_CHOOSER_URL = "https://github.com/DaNN-55/LifeFlow/issues/new/choose";

function recordDemoStarted() {
  alphaAnalytics.record("demo_started", { mode: "demo" });
}

function recordFeedbackClick() {
  alphaAnalytics.record("feedback_clicked", { mode: "public" });
}

onMounted(() => {
  alphaAnalytics.record("landing_viewed", { mode: "public" });
});
</script>

<template>
  <main class="landing-page">
    <header class="landing-nav">
      <RouterLink class="landing-brand" to="/" aria-label="LifeFlow 首页">
        <span class="landing-brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M5 4h5.6a8 8 0 0 1 0 16H5z" />
            <path d="m7.7 12 2.15 2.2 5.1-5.35" />
          </svg>
        </span>
        <span>LifeFlow</span>
      </RouterLink>
      <nav class="landing-nav-links" aria-label="页面导航">
        <a class="landing-nav-optional" href="#workflow">怎么使用</a>
        <a class="landing-nav-optional" href="#product-proof">小 Demo</a>
        <a href="#demo-boundary">完整 Demo</a>
        <a
          class="landing-nav-feedback"
          :href="GITHUB_ISSUE_CHOOSER_URL"
          target="_blank"
          rel="noreferrer"
          @click="recordFeedbackClick"
        >
          反馈<span class="landing-sr-only">（在新标签页打开）</span>
        </a>
        <RouterLink class="landing-login-link" to="/auth" aria-label="已有账号？登录">
          <span class="landing-login-label-long">已有账号？登录</span>
          <span class="landing-login-label-short">登录</span>
        </RouterLink>
      </nav>
    </header>

    <section class="landing-hero" aria-labelledby="landing-title">
      <div class="landing-hero-copy">
        <p class="landing-eyebrow"><span></span> LifeFlow Alpha</p>
        <h1 id="landing-title">
          <span>今天做了什么，</span>
          <span>复盘时一眼就能看见。</span>
        </h1>
        <p class="landing-lede">
          LifeFlow 把任务、执行备注和周复盘放在一起。安排好今天的任务，做完后随手记一句，周末就不用再靠记忆拼凑这一周。
        </p>
        <div class="landing-actions">
          <RouterLink class="landing-action landing-action-primary" to="/demo" @click="recordDemoStarted">
            先在 Demo 里试试 <span aria-hidden="true">→</span>
          </RouterLink>
          <a class="landing-action landing-action-secondary" :href="GITHUB_REPOSITORY_URL" target="_blank" rel="noreferrer">
            查看 GitHub <span aria-hidden="true">↗</span>
            <span class="landing-sr-only">（在新标签页打开）</span>
          </a>
        </div>
        <ul class="landing-trust-points" aria-label="Demo 说明">
          <li>不用注册</li>
          <li>只用示例数据</li>
          <li>可以随时重置</li>
        </ul>
      </div>

      <div class="landing-workflow-card" aria-label="LifeFlow Today 页面示意">
        <div class="landing-card-topline">
          <span>今天</span>
          <span class="landing-card-status">已保存</span>
        </div>
        <div class="landing-task-row is-complete"><span class="landing-check" aria-hidden="true">✓</span><span>整理本周客户反馈</span><em>已完成</em></div>
        <div class="landing-task-row"><span class="landing-check" aria-hidden="true"></span><span>准备下周计划</span><em>待处理</em></div>
        <div class="landing-note-preview">
          <span>执行备注</span>
          <p>客户最关心导出速度，下周先优化这一项。</p>
        </div>
        <div class="landing-review-row"><span>本周复盘</span><strong>3 个任务已完成</strong></div>
      </div>
    </section>

    <section id="workflow" class="landing-workflow" aria-labelledby="workflow-title">
      <div class="landing-section-heading">
        <p class="landing-eyebrow">怎么使用</p>
        <h2 id="workflow-title">每天记一点，周末就有东西可复盘。</h2>
      </div>
      <ol class="landing-workflow-grid">
        <li v-for="step in workflowSteps" :key="step.number" class="landing-workflow-step">
          <div class="landing-step-meta">
            <span>{{ step.number }}</span>
            <span>{{ step.moment }}</span>
          </div>
          <h3>{{ step.title }}</h3>
          <p>{{ step.description }}</p>
          <strong>{{ step.proof }}</strong>
        </li>
      </ol>
    </section>

    <section id="product-proof" class="landing-product-proof" aria-labelledby="product-proof-title">
      <div class="landing-proof-heading">
        <p class="landing-eyebrow">三个页面，一次看完</p>
        <h2 id="product-proof-title">任务、资讯和周复盘，切换看看。</h2>
        <p>下面的导览图按照当前 Demo 界面制作，使用的都是示例数据。</p>
      </div>
      <div class="landing-proof-layout">
        <div
          id="product-tour-panel"
          class="landing-product-tour-stage"
          role="tabpanel"
          :aria-labelledby="`product-tour-tab-${activeProductTour}`"
          tabindex="0"
        >
          <p class="landing-sr-only">{{ activeProductTourItem.title }}。{{ activeProductTourItem.detail }}</p>
          <div class="landing-tour-app" aria-hidden="true">
            <div class="landing-tour-topbar">
              <strong>LifeFlow</strong>
              <span class="landing-tour-main-nav">
                <i>Pulse</i>
                <i :class="{ 'is-active': activeProductTour !== 'news' }">Today</i>
                <i :class="{ 'is-active': activeProductTour === 'news' }">News</i>
              </span>
              <span>安全 Demo</span>
            </div>

            <div v-if="activeProductTour === 'today'" class="landing-tour-screen landing-tour-today">
              <aside>
                <span>Calendar</span>
                <strong>Heatmap</strong>
                <div class="landing-tour-heatmap"><i v-for="index in 35" :key="index" :class="{ 'is-filled': [8, 16, 17, 23, 30].includes(index) }"></i></div>
                <span>Project preview</span>
                <strong>GitHub</strong>
              </aside>
              <div class="landing-tour-primary">
                <div class="landing-tour-view-heading"><div><span>Focus mode</span><strong>Today</strong></div><em>0 / 2 已完成</em></div>
                <div class="landing-tour-subnav"><b>Today</b><span>Review</span><span>Timeline</span></div>
                <div class="landing-tour-task"><i></i><div><strong>规划今日重点</strong><span>#执行</span></div><em>提交记录</em></div>
                <div class="landing-tour-task"><i></i><div><strong>阅读并整理资讯</strong><span>#输入</span></div><em>提交记录</em></div>
                <div class="landing-tour-note"><strong>执行备注</strong><span>记录进展、卡点或下一步……</span></div>
              </div>
              <aside>
                <span>Weather</span><strong>24°</strong><small>晴间多云</small>
                <span>Favorites</span><small>还没有收藏资讯</small>
              </aside>
            </div>

            <div v-else-if="activeProductTour === 'news'" class="landing-tour-screen landing-tour-news">
              <aside>
                <span>Latest feed</span>
                <strong>News</strong>
                <small>Product Notes</small>
                <small>Tech Briefing</small>
                <small>收藏内容</small>
              </aside>
              <div class="landing-tour-primary">
                <div class="landing-tour-view-heading"><div><span>Unified reader</span><strong>News</strong></div><em>已读 0 / 4</em></div>
                <div class="landing-tour-search">搜索资讯</div>
                <div class="landing-tour-filters"><span>标签</span><span>来源</span><span>范围</span><span>排序</span></div>
                <article><div><strong>从任务清单到每天能做的事</strong><p>把目标拆成今天能完成的任务，做完后留下一条记录。</p><small>Product Notes · 方法</small></div><em>☆</em></article>
                <article><div><strong>断网时，内容还能不能看？</strong><p>网络断开时先用本地缓存，恢复后再继续同步。</p><small>Tech Briefing · 工程</small></div><em>☆</em></article>
                <article><div><strong>复盘以后，下一步做什么？</strong><p>从这周的执行记录里，找出下周先做的事。</p><small>Product Notes · 复盘</small></div><em>☆</em></article>
              </div>
              <aside>
                <span>Favorites</span><strong>收藏</strong><small>标记后会留在这里</small>
                <span>Demo</span><small>不请求真实信源</small>
              </aside>
            </div>

            <div v-else class="landing-tour-screen landing-tour-review">
              <aside>
                <span>Calendar</span>
                <strong>Heatmap</strong>
                <div class="landing-tour-heatmap"><i v-for="index in 35" :key="index" :class="{ 'is-filled': [8, 16, 17, 23, 30].includes(index) }"></i></div>
                <span>本周</span><strong>9/7–9/13</strong>
              </aside>
              <div class="landing-tour-primary">
                <div class="landing-tour-view-heading"><div><span>Retrospective</span><strong>Review</strong></div></div>
                <div class="landing-tour-subnav"><span>Today</span><b>Review</b><span>Timeline</span></div>
                <div class="landing-tour-filters"><span>周范围</span><span>任务</span><span>完成状态</span></div>
                <div class="landing-tour-summary"><span>Weekly wrap-up</span><strong>周总结</strong><p>这一周完成了核心计划，下周继续处理导出速度。</p></div>
                <div class="landing-tour-review-row"><div><strong>规划今日重点</strong><span>#执行</span></div><em>2 / 7 DAYS</em></div>
                <div class="landing-tour-review-row"><div><strong>阅读并整理资讯</strong><span>#输入</span></div><em>1 / 7 DAYS</em></div>
              </div>
              <aside>
                <span>本周记录</span><strong>4 条</strong><small>任务和备注按日期汇总</small>
                <span>周总结</span><small>尚未保存</small>
              </aside>
            </div>
          </div>
          <span class="landing-tour-caption">Demo 界面示意 · 不包含真实账号信息</span>
        </div>

        <div class="landing-product-tour-nav" role="tablist" aria-label="切换产品页面" aria-orientation="vertical">
          <button
            v-for="(item, index) in productTourItems"
            :id="`product-tour-tab-${item.id}`"
            :key="item.id"
            type="button"
            role="tab"
            :aria-selected="activeProductTour === item.id"
            aria-controls="product-tour-panel"
            :tabindex="activeProductTour === item.id ? 0 : -1"
            @click="selectProductTour(item.id)"
            @keydown.left.prevent="moveProductTour($event, index, -1)"
            @keydown.right.prevent="moveProductTour($event, index, 1)"
            @keydown.up.prevent="moveProductTour($event, index, -1)"
            @keydown.down.prevent="moveProductTour($event, index, 1)"
            @keydown.home.prevent="jumpProductTour($event, 0)"
            @keydown.end.prevent="jumpProductTour($event, productTourItems.length - 1)"
          >
            <span>{{ String(index + 1).padStart(2, "0") }}</span>
            <span>
              <b>{{ item.label }} <em v-if="activeProductTour === item.id">正在查看</em></b>
              <strong>{{ item.title }}</strong>
              <small>{{ item.detail }}</small>
            </span>
          </button>
          <RouterLink class="landing-inline-action" to="/demo" @click="recordDemoStarted">
            打开完整 Demo <span aria-hidden="true">→</span>
          </RouterLink>
        </div>
      </div>
    </section>

    <section class="landing-continuity" aria-labelledby="continuity-title">
      <div>
        <p class="landing-eyebrow">News</p>
        <h2 id="continuity-title">看到有用的资讯，先留在手边。</h2>
      </div>
      <div class="landing-continuity-copy">
        <p>在 News 里可以把资讯标记为已读或收藏。之后回到工作台，还能接着处理。</p>
        <p><strong>已有账号时</strong>网络不稳定也能看到最近一次同步的内容。还没同步成功的修改，会明确标成未同步。</p>
      </div>
    </section>

    <section id="demo-boundary" class="landing-demo-boundary" aria-labelledby="demo-title">
      <div class="landing-demo-copy">
        <p class="landing-eyebrow">公开体验</p>
        <h2 id="demo-title">不用注册，打开就能试。</h2>
        <p>完整 Demo 里只有示例任务和资讯，数据会保存在当前浏览器。它不会读取你的账号，也不会连接真实信源。</p>
        <div class="landing-actions landing-demo-actions">
          <RouterLink class="landing-action landing-action-primary" to="/demo" @click="recordDemoStarted">
            打开完整 Demo <span aria-hidden="true">→</span>
          </RouterLink>
          <RouterLink class="landing-text-link" to="/auth">已有账号？登录</RouterLink>
        </div>
      </div>
      <div class="landing-boundary-list" role="list" aria-label="Demo 使用说明">
        <div role="listitem"><span aria-hidden="true">✓</span><p><strong>可以做什么</strong>完成任务、查看示例资讯，也可以一键重置。</p></div>
        <div role="listitem"><span aria-hidden="true">○</span><p><strong>暂时不能做什么</strong>注册新账号、添加真实资讯源或跨设备同步。</p></div>
        <div role="listitem"><span aria-hidden="true">↗</span><p><strong>遇到问题</strong>可以在 GitHub 提交反馈，项目使用 Apache-2.0 许可证。</p></div>
      </div>
    </section>

    <section class="landing-faq" aria-labelledby="faq-title">
      <div class="landing-section-heading landing-faq-heading">
        <p class="landing-eyebrow">常见问题</p>
        <h2 id="faq-title">关于 Demo</h2>
      </div>
      <div class="landing-faq-list">
        <details v-for="item in frequentlyAskedQuestions" :key="item.question">
          <summary>{{ item.question }}<span aria-hidden="true">＋</span></summary>
          <p>{{ item.answer }}</p>
        </details>
      </div>
    </section>

    <footer class="landing-footer">
      <span>LifeFlow / 个人任务与复盘工具</span>
      <span class="landing-footer-links">
        <a :href="GITHUB_ISSUE_CHOOSER_URL" target="_blank" rel="noreferrer" @click="recordFeedbackClick">
          反馈问题<span class="landing-sr-only">（在新标签页打开）</span>
        </a>
        <a :href="GITHUB_REPOSITORY_URL" target="_blank" rel="noreferrer">
          查看 GitHub<span class="landing-sr-only">（在新标签页打开）</span>
        </a>
        <RouterLink to="/demo" @click="recordDemoStarted">打开完整 Demo →</RouterLink>
      </span>
    </footer>
  </main>
</template>
