<script setup>
import SettingsModal from "./SettingsModal.vue";

defineProps({
  open: { type: Boolean, default: false },
  apiStatus: { type: String, default: "unknown" },
  authenticated: { type: Boolean, default: false },
  profileLoading: { type: Boolean, default: false },
  profileCounts: {
    type: Object,
    default: () => ({
      tasks: 0,
      dailyRecords: 0,
      weeklySummaries: 0,
    }),
  },
  notices: { type: Array, default: () => [] },
  safetyBackup: { type: Object, default: null },
  transferBusy: { type: Boolean, default: false },
  transferMode: { type: String, default: "merge" },
  replaceImportConfirmed: { type: Boolean, default: false },
  formatDateTime: { type: Function, required: true },
});

const emit = defineEmits([
  "close",
  "export-data",
  "import-data",
  "restore-backup",
  "download-backup",
  "update:transfer-mode",
  "update:replace-import-confirmed",
]);

function handleImport(event) {
  const file = event.target.files?.[0];
  if (file) {
    emit("import-data", file);
  }
  event.target.value = "";
}
</script>

<template>
  <SettingsModal :open="open" title="同步中心" @close="emit('close')">
    <div class="account-profile-body">
      <div class="account-profile-grid">
        <div class="account-profile-item">
          <span class="account-profile-label">当前模式</span>
          <strong>{{ authenticated ? "云端已连接" : "未登录" }}</strong>
        </div>
        <div class="account-profile-item">
          <span class="account-profile-label">API 状态</span>
          <strong>{{ apiStatus === "ready" ? "后端在线" : "后端离线" }}</strong>
        </div>
        <div class="account-profile-item">
          <span class="account-profile-label">账号数据</span>
          <strong v-if="authenticated && !profileLoading">
            任务 {{ profileCounts.tasks }} 项 · 日记录 {{ profileCounts.dailyRecords }} 项 · 周总结 {{ profileCounts.weeklySummaries }} 项
          </strong>
          <strong v-else-if="authenticated">正在统计...</strong>
          <strong v-else>--</strong>
        </div>
        <div class="account-profile-item">
          <span class="account-profile-label">导出范围</span>
          <strong>{{ authenticated ? "完整账号备份" : "未登录" }}</strong>
          <p v-if="authenticated" class="settings-copy">会遍历当前账号的任务、全部日记录、全部周总结和偏好设置。</p>
        </div>
        <div class="account-profile-item">
          <span class="account-profile-label">最近安全备份</span>
          <strong>{{ safetyBackup?.createdAt ? formatDateTime(safetyBackup.createdAt) : "--" }}</strong>
          <p v-if="safetyBackup?.reason" class="settings-copy">原因：{{ safetyBackup.reason }}</p>
        </div>
      </div>

      <div class="account-profile-item">
        <span class="account-profile-label">数据工具</span>
        <div class="settings-field">
          <span class="widget-label">导入策略</span>
          <select :value="transferMode" :disabled="transferBusy" @change="emit('update:transfer-mode', $event.target.value)">
            <option value="merge">合并到当前账号</option>
            <option value="replace">完整覆盖当前账号</option>
          </select>
        </div>
        <label v-if="transferMode === 'replace'" class="sync-confirm-check">
          <input
            type="checkbox"
            :checked="replaceImportConfirmed"
            :disabled="transferBusy"
            @change="emit('update:replace-import-confirmed', $event.target.checked)"
          />
          <span>我确认用导入文件覆盖当前账号的任务、记录、周总结和偏好。</span>
        </label>
        <div class="data-transfer-actions">
          <button type="button" class="settings-save" :disabled="transferBusy" @click="emit('export-data')">导出数据</button>
          <label class="task-cancel-action sync-file-trigger">
            <input type="file" accept="application/json,.json" :disabled="transferBusy" @change="handleImport" />
            <span>{{ transferBusy ? "处理中..." : "导入数据" }}</span>
          </label>
          <button type="button" class="task-cancel-action" :disabled="!safetyBackup || transferBusy" @click="emit('download-backup')">
            导出最近安全备份
          </button>
          <button
            type="button"
            class="task-cancel-action"
            :disabled="!safetyBackup || transferBusy"
            @click="emit('restore-backup')"
          >
            恢复最近安全备份
          </button>
        </div>
        <p class="settings-copy">导入前会自动生成一份最近安全备份。导出会抓取当前账号的完整任务、日记录、周总结和偏好设置；导入仍保持 merge / replace 两种模式。</p>
      </div>

      <div class="account-profile-item">
        <span class="account-profile-label">最近状态</span>
        <div v-if="notices.length" class="sync-notice-list">
          <article v-for="item in notices" :key="item.id || item.createdAt" class="sync-notice" :data-tone="item.tone || 'default'">
            <strong>{{ item.message }}</strong>
            <span>{{ item.createdAt ? formatDateTime(item.createdAt) : "--" }}</span>
          </article>
        </div>
        <div v-else class="content-empty-state">最近还没有同步或恢复记录。</div>
      </div>
    </div>
  </SettingsModal>
</template>
