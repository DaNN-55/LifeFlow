<script setup>
import { computed } from "vue";

const props = defineProps({
  onboarding: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["collapse", "expand", "open-information", "open-review"]);

const steps = computed(() => [
  {
    id: "execute",
    title: "完成一个任务并写下执行备注",
    detail: "在 TODAY 勾选任务，再提交一条本次执行记录。",
    complete: Boolean(props.onboarding.executionRecorded),
  },
  {
    id: "favorite",
    title: "收藏一条合成资讯",
    detail: "在 News 中点亮任意一条合成资讯的收藏按钮。",
    complete: Boolean(props.onboarding.syntheticNewsFavorited),
  },
  {
    id: "review",
    title: "打开周期复盘查看执行事实",
    detail: "复盘会汇总刚才完成的任务和备注。",
    complete: Boolean(props.onboarding.periodReviewOpened),
  },
]);

const completedCount = computed(() => steps.value.filter((step) => step.complete).length);
</script>

<template>
  <button
    v-if="onboarding.collapsed"
    type="button"
    class="demo-onboarding-reopen"
    @click="emit('expand')"
  >
    <span class="material-symbols-outlined" aria-hidden="true">route</span>
    体验进度 {{ completedCount }} / {{ steps.length }}
  </button>

  <aside v-else class="demo-onboarding" aria-labelledby="demo-onboarding-title">
    <div class="demo-onboarding-head">
      <div>
        <p>Safe Demo</p>
        <h2 id="demo-onboarding-title">从执行到复盘</h2>
      </div>
      <button type="button" class="demo-onboarding-collapse" aria-label="收起体验清单" @click="emit('collapse')">
        <span class="material-symbols-outlined" aria-hidden="true">expand_less</span>
      </button>
    </div>

    <ol class="demo-onboarding-steps">
      <li v-for="step in steps" :key="step.id" :class="{ 'is-complete': step.complete }">
        <span class="material-symbols-outlined" aria-hidden="true">{{ step.complete ? "check_circle" : "radio_button_unchecked" }}</span>
        <span>
          <strong>{{ step.title }}</strong>
          <small v-if="step.complete">已完成</small>
          <template v-else-if="step.id === 'favorite'">
            <small>{{ step.detail }}</small>
            <button type="button" class="demo-onboarding-review-link" @click="emit('open-information')">查看合成资讯</button>
          </template>
          <template v-else-if="step.id === 'review'">
            <small>{{ step.detail }}</small>
            <button type="button" class="demo-onboarding-review-link" @click="emit('open-review')">打开周期复盘</button>
          </template>
          <small v-else>{{ step.detail }}</small>
        </span>
      </li>
    </ol>
  </aside>
</template>

<style scoped>
.demo-onboarding {
  margin: 0 0 18px;
  padding: 14px 16px;
  color: #e2e8f0;
  background: linear-gradient(115deg, #172554, #1e293b);
  border: 1px solid #334155;
  border-radius: 14px;
}

.demo-onboarding-head,
.demo-onboarding-steps li,
.demo-onboarding-reopen {
  display: flex;
  align-items: center;
}

.demo-onboarding-head {
  justify-content: space-between;
  gap: 16px;
}

.demo-onboarding-head p {
  margin: 0 0 3px;
  color: #93c5fd;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.demo-onboarding-head h2 {
  margin: 0;
  font-size: 16px;
}

.demo-onboarding-collapse,
.demo-onboarding-reopen {
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.demo-onboarding-collapse {
  display: grid;
  width: 30px;
  height: 30px;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 8px;
  place-items: center;
}

.demo-onboarding-collapse:hover,
.demo-onboarding-collapse:focus-visible {
  background: rgb(255 255 255 / 12%);
  outline: none;
}

.demo-onboarding-steps {
  display: grid;
  gap: 10px;
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
}

.demo-onboarding-steps li {
  gap: 10px;
  color: #cbd5e1;
}

.demo-onboarding-steps li > .material-symbols-outlined {
  color: #94a3b8;
}

.demo-onboarding-steps li.is-complete > .material-symbols-outlined,
.demo-onboarding-steps li.is-complete strong {
  color: #86efac;
}

.demo-onboarding-steps strong,
.demo-onboarding-steps small {
  display: block;
}

.demo-onboarding-review-link {
  padding: 0;
  color: #bfdbfe;
  background: transparent;
  border: 0;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.demo-onboarding-steps strong {
  font-size: 14px;
}

.demo-onboarding-steps small {
  margin-top: 2px;
  color: #94a3b8;
  font-size: 12px;
}

.demo-onboarding-reopen {
  gap: 7px;
  margin: 0 0 14px;
  padding: 7px 10px;
  color: #475569;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  font-size: 13px;
}
</style>
