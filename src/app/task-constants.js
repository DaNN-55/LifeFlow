export const TASK_COLOR_PALETTES = [
  { id: "indigo", label: "靛蓝", value: "#4f46e5" },
  { id: "teal", label: "青绿", value: "#0f766e" },
  { id: "amber", label: "琥珀", value: "#ca8a04" },
  { id: "red", label: "赤红", value: "#dc2626" },
  { id: "violet", label: "紫红", value: "#7c3aed" },
  { id: "sky", label: "天青", value: "#0284c7" },
  { id: "emerald", label: "翠绿", value: "#059669" },
  { id: "rose", label: "玫红", value: "#e11d48" },
];

export function getRandomTaskColor() {
  return TASK_COLOR_PALETTES[Math.floor(Math.random() * TASK_COLOR_PALETTES.length)]?.value || "#4f46e5";
}
