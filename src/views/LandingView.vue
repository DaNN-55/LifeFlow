<script setup>
import { onMounted } from "vue";
import { RouterLink } from "vue-router";

import { alphaAnalytics } from "../services/alpha-analytics.js";
import "../styles/landing.css";

const capabilities = [
  {
    number: "01",
    title: "每日执行",
    description: "把今天真正要推进的事项放到一个清晰的执行面板里。",
  },
  {
    number: "02",
    title: "过程记录",
    description: "在任务旁留下进展、卡点和判断，让行动不是一次性消耗。",
  },
  {
    number: "03",
    title: "周期复盘",
    description: "用周度视图回看完成、未完成与下一步，形成持续调整的节奏。",
  },
  {
    number: "04",
    title: "信息输入与状态连续",
    description: "把有价值的输入和你的当前状态放在同一条工作流里。",
  },
];

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
        <span class="landing-brand-mark" aria-hidden="true">↘</span>
        <span>LifeFlow</span>
      </RouterLink>
      <nav class="landing-nav-links" aria-label="展示页导航">
        <a href="#capabilities">能力</a>
        <a href="#demo-boundary">安全 Demo</a>
        <a :href="GITHUB_ISSUE_CHOOSER_URL" target="_blank" rel="noreferrer" @click="recordFeedbackClick">反馈</a>
        <RouterLink to="/auth">已有账号登录</RouterLink>
      </nav>
    </header>

    <section class="landing-hero" aria-labelledby="landing-title">
      <div class="landing-hero-copy">
        <p class="landing-eyebrow"><span></span> Alpha 公开体验中</p>
        <h1 id="landing-title">让执行留下痕迹，<br />让复盘带来下一步。</h1>
        <p class="landing-lede">LifeFlow 把每日执行、过程记录和周期复盘连成一个轻量的个人工作系统，让你不必每次都从零开始。</p>
        <div class="landing-actions">
          <RouterLink class="landing-action landing-action-primary" to="/demo" @click="recordDemoStarted">立即体验安全 Demo <span aria-hidden="true">→</span></RouterLink>
          <a class="landing-action landing-action-secondary" href="https://github.com/DaNN-55/LifeFlow" target="_blank" rel="noreferrer">查看 GitHub <span aria-hidden="true">↗</span></a>
        </div>
      </div>

      <div class="landing-workflow-card" aria-label="执行到复盘的工作流示意">
        <div class="landing-card-topline">
          <span>今天</span>
          <span class="landing-card-status">已连接</span>
        </div>
        <div class="landing-task-row is-complete"><span class="landing-check">✓</span><span>规划今日重点</span><em>已记录</em></div>
        <div class="landing-task-row"><span class="landing-check"></span><span>推进核心任务</span><em>进行中</em></div>
        <div class="landing-task-row"><span class="landing-check"></span><span>整理信息输入</span><em>待处理</em></div>
        <div class="landing-card-divider"></div>
        <div class="landing-review-row"><span>本周复盘</span><strong>执行 → 记录 → 复盘</strong></div>
      </div>
    </section>

    <section id="capabilities" class="landing-capabilities" aria-labelledby="capabilities-title">
      <div class="landing-section-heading">
        <p class="landing-eyebrow">一个连续的个人工作流</p>
        <h2 id="capabilities-title">从今天的行动，到下一次更好的判断。</h2>
      </div>
      <div class="landing-capability-grid">
        <article v-for="capability in capabilities" :key="capability.number" class="landing-capability">
          <span>{{ capability.number }}</span>
          <h3>{{ capability.title }}</h3>
          <p>{{ capability.description }}</p>
        </article>
      </div>
    </section>

    <section id="demo-boundary" class="landing-demo-boundary" aria-labelledby="demo-title">
      <div>
        <p class="landing-eyebrow">先安全地试一遍</p>
        <h2 id="demo-title">安全 Demo 不需要注册。</h2>
        <p>Demo 使用合成任务、资讯和状态信息；所有数据只保存在当前浏览器，可随时一键重置。它用于熟悉工作流，不会连接或写入你的真实账号。</p>
      </div>
      <div class="landing-boundary-list" role="list" aria-label="Demo 与真实账号的边界">
        <div role="listitem"><span aria-hidden="true">✓</span><p><strong>安全 Demo</strong>合成信息、本地浏览器存储、可重置</p></div>
        <div role="listitem"><span aria-hidden="true">→</span><p><strong>真实账号</strong>登录后独立使用，不与 Demo 数据混合</p></div>
      </div>
    </section>

    <footer class="landing-footer">
      <span>LifeFlow / Personal execution system</span>
      <span class="landing-footer-links">
        <a :href="GITHUB_ISSUE_CHOOSER_URL" target="_blank" rel="noreferrer" @click="recordFeedbackClick">反馈与贡献</a>
        <RouterLink to="/demo" @click="recordDemoStarted">进入安全 Demo →</RouterLink>
      </span>
    </footer>
  </main>
</template>
