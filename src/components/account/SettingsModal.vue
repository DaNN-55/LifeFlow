<script setup>
defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: "" },
  kicker: { type: String, default: "" },
  dialogClass: { type: String, default: "" },
});

const emit = defineEmits(["close"]);
</script>

<template>
  <div v-if="open" class="settings-modal">
    <div class="settings-backdrop" @click="emit('close')"></div>
    <section
      class="settings-dialog"
      :class="dialogClass"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      @click.stop
      @pointerdown.stop
    >
      <div class="settings-header">
        <div>
          <p v-if="kicker" class="panel-kicker settings-kicker">{{ kicker }}</p>
          <h2>{{ title }}</h2>
        </div>
        <button type="button" class="modal-close" aria-label="关闭弹窗" @click.stop.prevent="emit('close')">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <slot />
    </section>
  </div>
</template>
