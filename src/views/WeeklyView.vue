<script setup>
import { computed, onMounted, ref, watch } from "vue";

import ToolbarSelect from "../components/common/ToolbarSelect.vue";
import TaskDialog from "../components/today/TaskDialog.vue";
import MonthlyOverviewCard from "../components/weekly/MonthlyOverviewCard.vue";
import WeeklyReviewCard from "../components/weekly/WeeklyReviewCard.vue";
import { useTodayStore } from "../stores/today";
import { useSessionStore } from "../stores/session";
import { useWeeklyStore } from "../stores/weekly";

const sessionStore = useSessionStore();
const todayStore = useTodayStore();
const weeklyStore = useWeeklyStore();
const expandedReviewCards = ref({});

const isAuthenticated = computed(() => Boolean(sessionStore.user?.id));
const showSummaryEdit = computed(
  () => weeklyStore.mode === "week" && weeklyStore.currentSummaryMode !== "view",
);

function handleEditSummary() {
  weeklyStore.setSummaryMode("edit");
}

function handleSaveSummary() {
  weeklyStore.openSummaryDialog();
}

function isReviewExpanded(taskId) {
  return Boolean(expandedReviewCards.value[String(taskId)]);
}

function toggleReviewCard(taskId) {
  const key = String(taskId);
  expandedReviewCards.value = {
    ...expandedReviewCards.value,
    [key]: !isReviewExpanded(key),
  };
}

onMounted(async () => {
  if (isAuthenticated.value) {
    await weeklyStore.bootstrap();
  }
});

watch(
  () => sessionStore.user?.id,
  async (userId) => {
    if (userId) {
      await weeklyStore.bootstrap();
    }
  },
);
</script>

<template>
  <section class="stage-view">
    <section class="content-panel is-active" aria-labelledby="weekly-panel-title">
      <div class="panel-header">
        <div>
          <p class="panel-kicker">Retrospective</p>
          <h1 id="weekly-panel-title">Weekly</h1>
        </div>
      </div>

      <div v-if="isAuthenticated && weeklyStore.saveStatus" class="save-note-row">
        <p class="save-note" data-tone="default">{{ weeklyStore.saveStatus }}</p>
      </div>

      <div v-if="!isAuthenticated" class="today-state-card">
        <h2>未连接账号</h2>
        <p>Weekly 模块需要先连接现有后端账号。</p>
      </div>

      <template v-else>
        <div class="weekly-tools">
          <div class="weekly-review-controls toolbar-filter-bar">
            <div class="weekly-mode-block">
              <span class="weekly-filter-label">复盘范围</span>
              <div class="toolbar-control">
                <div class="weekly-mode-toggle" :data-active-mode="weeklyStore.mode">
                  <button
                    type="button"
                    class="task-cancel-action"
                    :class="{ 'is-active': weeklyStore.mode === 'week' }"
                    @click="weeklyStore.setMode('week')"
                  >
                    按周
                  </button>
                  <button
                    type="button"
                    class="task-cancel-action"
                    :class="{ 'is-active': weeklyStore.mode === 'month' }"
                    @click="weeklyStore.setMode('month')"
                  >
                    按月
                  </button>
                </div>
              </div>
            </div>

            <label class="weekly-filter-field">
              <span class="weekly-filter-label">{{ weeklyStore.mode === "month" ? "月范围" : "周范围" }}</span>
              <ToolbarSelect
                :model-value="weeklyStore.mode === 'month' ? weeklyStore.selectedMonth : weeklyStore.selectedWeek"
                icon="calendar_month"
                :options="weeklyStore.rangeOptions"
                @update:model-value="
                  weeklyStore.mode === 'month'
                    ? weeklyStore.setSelectedMonth($event)
                    : weeklyStore.setSelectedWeek($event)
                "
              />
            </label>

            <label class="weekly-filter-field">
              <span class="weekly-filter-label">任务</span>
              <ToolbarSelect
                :model-value="weeklyStore.filters.taskId"
                icon="task_alt"
                :options="weeklyStore.taskFilterOptions"
                @update:model-value="weeklyStore.setFilter('taskId', $event)"
              />
            </label>

            <label class="weekly-filter-field">
              <span class="weekly-filter-label">完成状态</span>
              <ToolbarSelect
                :model-value="weeklyStore.filters.completion"
                icon="radio_button_checked"
                :options="weeklyStore.completionFilterOptions"
                @update:model-value="weeklyStore.setFilter('completion', $event)"
              />
            </label>

            <label class="weekly-filter-field">
              <span class="weekly-filter-label">存档状态</span>
              <ToolbarSelect
                :model-value="weeklyStore.filters.archive"
                icon="inventory_2"
                :options="weeklyStore.archiveFilterOptions"
                @update:model-value="weeklyStore.setFilter('archive', $event)"
              />
            </label>
          </div>

          <MonthlyOverviewCard
            v-if="weeklyStore.mode === 'month'"
            :overview="weeklyStore.monthOverview"
            :tags-by-task-id="sessionStore.user?.preferences?.tasks?.tagsByTaskId || {}"
            :icon-by-task-id="sessionStore.user?.preferences?.tasks?.iconByTaskId || {}"
          />

          <section
            v-else
            class="weekly-summary-card"
            :class="{
              'is-empty': !weeklyStore.currentSummary.content,
              'is-editing': weeklyStore.currentSummaryMode !== 'view',
              'is-saved': weeklyStore.currentSummaryMode === 'view' && weeklyStore.currentSummary.content,
            }"
            aria-labelledby="weekly-summary-title"
          >
            <div class="section-head">
              <div>
                <p class="panel-kicker">Weekly wrap-up</p>
                <h2 id="weekly-summary-title">周总结</h2>
              </div>
              <div class="weekly-summary-actions">
                <button
                  v-if="weeklyStore.currentSummaryMode === 'view' && weeklyStore.currentSummary.content"
                  type="button"
                  class="settings-save"
                  @click="handleEditSummary"
                >
                  修改
                </button>
                <button
                  v-else
                  type="button"
                  class="settings-save"
                  @click="handleSaveSummary"
                >
                  保存总结
                </button>
              </div>
            </div>

            <textarea
              v-if="showSummaryEdit"
              class="weekly-summary-input"
              :value="weeklyStore.currentSummaryDraft"
              placeholder="记录本周的收获、问题和下一步。支持 Markdown。"
              @input="weeklyStore.updateSummaryDraft($event.target.value)"
            />
            <div
              v-else-if="weeklyStore.mode === 'week' && weeklyStore.currentSummary.content"
              class="weekly-summary-display"
              v-html="weeklyStore.summaryDisplayHtml"
            />
            <div v-else class="weekly-summary-display">
              <p>本周还没有保存总结。</p>
            </div>

            <p class="weekly-summary-meta" :class="{ 'is-dirty': weeklyStore.currentSummaryDraft !== weeklyStore.currentSummary.content }">
              {{ weeklyStore.summaryMeta }}
            </p>
          </section>
        </div>

        <div v-if="weeklyStore.loading" class="today-state-card">
          <h2>正在载入</h2>
          <p>正在读取周复盘数据。</p>
        </div>

        <div v-else-if="weeklyStore.error" class="today-state-card">
          <h2>载入失败</h2>
          <p>{{ weeklyStore.error }}</p>
        </div>

        <div v-else-if="weeklyStore.visibleTasks.length === 0" class="today-state-card">
          <h2>暂无匹配结果</h2>
          <p>尝试切换周/月范围，或放宽筛选条件。</p>
        </div>

        <div v-else-if="weeklyStore.mode === 'week'" class="review-stack">
              <WeeklyReviewCard
                v-for="task in weeklyStore.visibleTasks"
                :key="task.id"
                :task="task"
                :task-icon="todayStore.getTaskIcon(task.id, task.name)"
                :tags="sessionStore.user?.preferences?.tasks?.tagsByTaskId?.[task.id] || []"
            :completion-count="task.completionCount"
            :total-days="task.totalDays"
            :notes="task.notes"
            :expanded="isReviewExpanded(task.id)"
            @toggle="toggleReviewCard"
            @restore-task="todayStore.restoreTask"
          />
        </div>
      </template>
    </section>

    <TaskDialog
      :open="weeklyStore.summaryDialogOpen"
      title="保存周总结"
      :copy="`确认保存 ${weeklyStore.selectedWeek} 的周总结吗？`"
      confirm-label="确认保存"
      @cancel="weeklyStore.closeSummaryDialog"
      @confirm="weeklyStore.saveSummary"
    />

  </section>
</template>
