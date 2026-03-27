<script setup>
import { DEFAULT_RSSHUB_INSTANCE } from "../../app/constants";
import TaskDialog from "../today/TaskDialog.vue";

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: "" },
  sources: { type: Array, default: () => [] },
  hiddenSources: { type: Array, default: () => [] },
  failures: { type: Array, default: () => [] },
  feedback: { type: Object, default: null },
  form: { type: Object, required: true },
});

const emit = defineEmits([
  "close",
  "save-source",
  "edit-source",
  "delete-source",
  "hide-source",
  "unhide-source",
  "toggle-source-enabled",
  "update:form",
]);

function patchForm(patch) {
  emit("update:form", {
    ...props.form,
    ...patch,
  });
}

function getFailure(sourceId) {
  return props.failures.find((item) => item.sourceId === sourceId);
}

function formatSourceType(type = "") {
  if (type === "rsshub") {
    return "RSSHub";
  }
  if (type === "site") {
    return "网站";
  }
  return "RSS / Atom";
}

function normalizeRsshubInstance(value = "") {
  return String(value || DEFAULT_RSSHUB_INSTANCE)
    .trim()
    .replace(/\/+$/, "");
}

function getDisplayUrl(source = {}) {
  if (source.type !== "rsshub") {
    return String(source.url || "").trim();
  }
  const route = String(source.url || "").trim();
  if (!route) {
    return "";
  }
  if (/^https?:\/\//i.test(route)) {
    return route;
  }
  const normalizedRoute = route.startsWith("/") ? route : `/${route}`;
  return `${normalizeRsshubInstance(source.parser_key)}${normalizedRoute}`;
}
</script>

<template>
  <TaskDialog
    :open="open"
    :title="title"
    dialog-class="content-source-dialog-card"
    cancel-label="关闭"
    confirm-label="保存信源"
    @cancel="emit('close')"
    @confirm="emit('save-source')"
  >
    <div class="content-source-dialog">
      <div v-if="feedback?.message" class="content-source-feedback" :data-tone="feedback.tone || 'default'">
        {{ feedback.message }}
      </div>

      <div class="content-source-form">
        <div class="content-source-form-grid">
          <label class="weekly-filter-field">
            <span class="widget-label">名称</span>
            <input :value="form.name" type="text" placeholder="信源名称" @input="patchForm({ name: $event.target.value })" />
          </label>
          <label class="weekly-filter-field">
            <span class="widget-label">类型</span>
            <select :value="form.type" @change="patchForm({ type: $event.target.value })">
              <option value="rss">RSS / Atom</option>
              <option value="rsshub">RSSHub</option>
              <option value="site">网站</option>
            </select>
          </label>
        </div>

        <label class="weekly-filter-field">
          <span class="widget-label">状态</span>
          <select :value="String(form.enabled)" @change="patchForm({ enabled: $event.target.value === 'true' })">
            <option value="true">启用</option>
            <option value="false">停用</option>
          </select>
        </label>

        <label class="weekly-filter-field">
          <span class="widget-label">{{ form.type === "rsshub" ? "RSSHub Route / 链接" : "链接" }}</span>
          <input
            :value="form.url"
            :placeholder="form.type === 'rsshub' ? '/github/issue/openai/openai-python 或完整 RSSHub 链接' : 'https://example.com/feed.xml'"
            @input="patchForm({ url: $event.target.value })"
          />
        </label>

        <label class="weekly-filter-field">
          <span class="widget-label">{{ form.type === "rsshub" ? "RSSHub 实例（可选）" : "解析标识（可选）" }}</span>
          <input
            :value="form.parserKey"
            :placeholder="form.type === 'rsshub' ? 'https://rsshub.zhsh.me' : '默认留空，优先自动识别'"
            @input="patchForm({ parserKey: $event.target.value })"
          />
        </label>

        <p class="content-source-hint">
          {{ form.type === "rsshub" ? "可填写 route 或完整 RSSHub 链接。" : "支持普通 RSS / Atom 链接，也支持网站自动识别。" }}
        </p>
      </div>

      <div class="content-source-list">
        <div v-if="sources.length === 0 && hiddenSources.length === 0" class="content-empty-state">当前没有可用信源。</div>

        <article v-for="source in sources" :key="source.id" class="content-source-item">
          <div>
            <strong>{{ source.name }}</strong>
            <p>{{ getDisplayUrl(source) }}</p>
            <span class="feed-meta">{{ formatSourceType(source.type) }} · {{ source.enabled ? "已启用" : "已停用" }}</span>
            <p v-if="source.parser_key" class="feed-meta">实例：{{ source.parser_key }}</p>
            <p v-if="getFailure(source.id)" class="content-source-status is-error">
              最近刷新失败 · {{ getFailure(source.id).message || "未知错误" }}
            </p>
          </div>
          <div class="content-source-item-actions">
            <button type="button" class="task-cancel-action" @click="emit('edit-source', source.id)">编辑</button>
            <button type="button" class="task-cancel-action" @click="emit('toggle-source-enabled', source.id)">
              {{ source.enabled ? "停用" : "启用" }}
            </button>
            <button type="button" class="task-cancel-action" @click="emit('hide-source', source.id)">隐藏来源</button>
            <button type="button" class="settings-save is-danger" @click="emit('delete-source', source.id)">删除</button>
          </div>
        </article>

        <article v-for="source in hiddenSources" :key="`hidden-${source.id}`" class="content-source-item">
          <div>
            <strong>{{ source.name }}</strong>
            <p>{{ getDisplayUrl(source) }}</p>
          </div>
          <div class="content-source-item-actions">
            <button type="button" class="task-cancel-action" @click="emit('unhide-source', source.id)">恢复显示</button>
          </div>
        </article>
      </div>
    </div>
  </TaskDialog>
</template>
