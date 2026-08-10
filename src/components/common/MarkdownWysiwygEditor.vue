<script setup>
import { onBeforeUnmount, onMounted, watch, ref } from "vue";

import { Crepe } from "@milkdown/crepe";
import { replaceAll } from "@milkdown/kit/utils";

import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/classic.css";

const props = defineProps({
  modelValue: {
    type: String,
    default: "",
  },
  placeholder: {
    type: String,
    default: "请输入内容...",
  },
  maxlength: {
    type: Number,
    default: 0,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:modelValue"]);

const editorRootRef = ref(null);
let crepe = null;
let suppressUpdate = false;
let lastValue = "";

function normalizeValue(value) {
  return String(value || "");
}

function clampValue(value) {
  const normalized = normalizeValue(value);
  if (props.maxlength > 0 && normalized.length > props.maxlength) {
    return normalized.slice(0, props.maxlength);
  }
  return normalized;
}

function applyEditorContent(value) {
  if (!crepe) {
    return;
  }
  suppressUpdate = true;
  crepe.editor.action(replaceAll(value));
  lastValue = value;
  queueMicrotask(() => {
    suppressUpdate = false;
  });
}

async function mountEditor() {
  if (!editorRootRef.value) {
    return;
  }

  const initialValue = clampValue(props.modelValue);
  lastValue = initialValue;

  crepe = new Crepe({
    root: editorRootRef.value,
    defaultValue: initialValue,
    features: {
      [Crepe.Feature.CodeMirror]: false,
      [Crepe.Feature.ImageBlock]: false,
      [Crepe.Feature.Table]: false,
      [Crepe.Feature.Latex]: false,
      [Crepe.Feature.TopBar]: false,
    },
    featureConfigs: {
      [Crepe.Feature.Placeholder]: {
        mode: "doc",
        text: props.placeholder,
      },
    },
  }).on((listener) => {
    listener.markdownUpdated((_ctx, markdown) => {
      if (suppressUpdate) {
        return;
      }

      const nextValue = clampValue(markdown);

      if (nextValue !== markdown) {
        applyEditorContent(nextValue);
      }

      if (nextValue === lastValue) {
        return;
      }

      lastValue = nextValue;
      emit("update:modelValue", nextValue);
    });
  });

  await crepe.create();
  crepe.setReadonly(Boolean(props.disabled));

  if (initialValue !== normalizeValue(props.modelValue)) {
    emit("update:modelValue", initialValue);
  }
}

onMounted(() => {
  mountEditor();
});

watch(
  () => props.modelValue,
  (value) => {
    const nextValue = clampValue(value);
    if (nextValue !== normalizeValue(value)) {
      emit("update:modelValue", nextValue);
    }
    if (!crepe || nextValue === lastValue) {
      return;
    }
    applyEditorContent(nextValue);
  },
);

watch(
  () => props.disabled,
  (value) => {
    if (!crepe) {
      return;
    }
    crepe.setReadonly(Boolean(value));
  },
);

onBeforeUnmount(() => {
  if (!crepe) {
    return;
  }
  const instance = crepe;
  crepe = null;
  instance.destroy().catch(() => {});
});
</script>

<template>
  <div ref="editorRootRef" class="markdown-wysiwyg-editor" />
</template>
