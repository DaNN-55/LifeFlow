export function normalizeThemePreference(theme) {
  return theme === "dark" ? "dark" : "light";
}

export function getFallbackColor(index) {
  const palette = ["#4f46e5", "#0f766e", "#ca8a04", "#dc2626", "#7c3aed", "#0284c7"];
  return palette[index % palette.length];
}

export function getRandomPaletteColor() {
  const palette = ["#4f46e5", "#0f766e", "#ca8a04", "#dc2626", "#7c3aed", "#0284c7", "#059669", "#e11d48"];
  return palette[Math.floor(Math.random() * palette.length)];
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
