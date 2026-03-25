<script setup>
import { nextTick, ref } from "vue";

import ToolbarSelect from "../common/ToolbarSelect.vue";

const action = ref("");
const options = [
  { value: "open-songsterr", label: "songster" },
];

async function handleAction(value) {
  action.value = value;
  if (value === "open-songsterr") {
    window.open("https://www.songsterr.com/", "_blank", "noopener,noreferrer");
    await nextTick();
    action.value = "";
  }
}
</script>

<template>
  <div class="fretflow-header-actions">
    <ToolbarSelect :model-value="action" icon="library_music" :options="options" @update:model-value="handleAction" />
  </div>
</template>
