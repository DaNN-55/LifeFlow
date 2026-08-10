<script setup>
import SettingsModal from "./SettingsModal.vue";

defineProps({
  open: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  feedback: { type: String, default: "" },
  form: { type: Object, required: true },
});

const emit = defineEmits(["close", "update:form", "save"]);
</script>

<template>
  <SettingsModal :open="open" title="修改密码" @close="emit('close')">
    <form class="settings-form account-form" @submit.prevent="emit('save')">
      <label class="settings-field">
        <span class="widget-label">当前密码</span>
        <input
          :value="form.currentPassword"
          type="password"
          autocomplete="current-password"
          @input="emit('update:form', { ...form, currentPassword: $event.target.value })"
        />
      </label>
      <label class="settings-field">
        <span class="widget-label">新密码</span>
        <input
          :value="form.newPassword"
          type="password"
          autocomplete="new-password"
          @input="emit('update:form', { ...form, newPassword: $event.target.value })"
        />
      </label>
      <label class="settings-field">
        <span class="widget-label">确认新密码</span>
        <input
          :value="form.confirmPassword"
          type="password"
          autocomplete="new-password"
          @input="emit('update:form', { ...form, confirmPassword: $event.target.value })"
        />
      </label>
      <p class="delete-task-dialog-copy">{{ feedback || "修改后请使用新密码登录。" }}</p>
      <div class="delete-task-dialog-actions">
        <button type="button" class="task-cancel-action" @click="emit('close')">取消</button>
        <button type="submit" class="settings-save" :disabled="busy">{{ busy ? "保存中..." : "保存密码" }}</button>
      </div>
    </form>
  </SettingsModal>
</template>
