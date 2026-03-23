<script setup>
import { contentTabs, MAX_STOCK_WIDGET_ITEMS } from "../../app/constants";
import SettingsModal from "./SettingsModal.vue";

const props = defineProps({
  open: { type: Boolean, default: false },
  widget: { type: String, default: "" },
  profileForm: { type: Object, required: true },
  feedback: { type: String, default: "" },
  busy: { type: Boolean, default: false },
});

const emit = defineEmits(["close", "save", "update:profile-form"]);

function updateWidgets(nextWidgets) {
  emit("update:profile-form", {
    ...props.profileForm,
    widgets: {
      ...props.profileForm.widgets,
      ...nextWidgets,
    },
  });
}
</script>

<template>
  <SettingsModal
    :open="open"
    kicker="Settings"
    :title="widget === 'favorites' ? 'Favorites 设置' : widget === 'weather' ? 'Weather 设置' : 'Stock 设置'"
    dialog-class="widget-settings-dialog"
    @close="emit('close')"
  >
    <form class="account-form widget-settings-form" @submit.prevent="emit('save')">
      <template v-if="widget === 'favorites'">
        <label class="settings-field">
          <span class="widget-label">显示范围</span>
          <select
            :value="profileForm.widgets.favorites.channel"
            @change="
              updateWidgets({
                favorites: {
                  ...profileForm.widgets.favorites,
                  channel: $event.target.value,
                },
              })
            "
          >
            <option value="all">全部频道</option>
            <option v-for="tab in contentTabs" :key="tab.id" :value="tab.id">仅 {{ tab.label }}</option>
          </select>
        </label>
      </template>

      <template v-else-if="widget === 'weather'">
        <p class="settings-copy">可填写城市/地区名称来固定天气位置；留空时继续使用自动定位。</p>
        <label class="settings-field">
          <span class="widget-label">位置</span>
          <input
            :value="profileForm.widgets.weather.locationQuery"
            type="text"
            placeholder="例如：上海、杭州西湖、Shenzhen"
            @input="
              updateWidgets({
                weather: {
                  ...profileForm.widgets.weather,
                  locationQuery: $event.target.value,
                },
              })
            "
          />
        </label>
      </template>

      <template v-else-if="widget === 'stock'">
        <p class="settings-copy">
          输入 A 股股票代码或股票名称，支持逗号或换行分隔，例如：贵州茅台、000001。当前最多展示 {{ MAX_STOCK_WIDGET_ITEMS }} 条。
        </p>
        <label class="settings-field">
          <span class="widget-label">代码列表</span>
          <textarea
            :value="profileForm.widgets.stock.symbols"
            placeholder="贵州茅台, 宁德时代, 000001"
            @input="
              updateWidgets({
                stock: {
                  ...profileForm.widgets.stock,
                  symbols: $event.target.value,
                },
              })
            "
          ></textarea>
        </label>
      </template>

      <p v-if="feedback" class="settings-copy">{{ feedback }}</p>

      <div class="settings-actions">
        <button type="submit" class="settings-save" :disabled="busy">
          {{ busy ? "保存中..." : "保存设置" }}
        </button>
      </div>
    </form>
  </SettingsModal>
</template>
