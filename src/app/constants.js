export const API_BASE_STORAGE_KEY = "lifeflow-private-dashboard-api-base";
export const DEFAULT_REMOTE_API_BASE = "https://lifeflow-backend-mrs1.onrender.com";
export const DEFAULT_RSSHUB_INSTANCE = "https://rsshub.zhsh.me";
export const SESSION_STORAGE_KEY = "lifeflow-private-dashboard-session";
export const OFFLINE_SESSION_STORAGE_KEY = "lifeflow-private-dashboard-offline-session";
export const AUTH_CONFIG_STORAGE_KEY = "lifeflow-private-dashboard-auth-config";
export const APP_THEME_STORAGE_KEY = "lifeflow-private-dashboard-vue-theme";
export const PREVIEW_MODE_STORAGE_KEY = "lifeflow-private-dashboard-vue-preview-mode";
export const API_PROBE_TIMEOUT_MS = 12000;
export const SAFETY_BACKUP_STORAGE_KEY = "lifeflow-private-dashboard-vue-safety-backup";
export const AUTH_GATE_ENABLED = true;
export const ACCOUNT_CONTROLS_ENABLED = true;
export const AUTH_CHALLENGE_ENABLED = true;
export const AUTH_PREVIEW_ENABLED = true;
export function resolveAuthSignupEnabled(value) {
  return String(value ?? "").trim().toLowerCase() === "true";
}
export const AUTH_SIGNUP_ENABLED = resolveAuthSignupEnabled(import.meta.env?.VITE_AUTH_SIGNUP_ENABLED);
export const FRETFLOW_ENABLED = false;

export const topTabs = [
  { id: "pulse", label: "Pulse", to: "/pulse" },
  { id: "today", label: "Today", to: "/today" },
  { id: "content", label: "News", to: "/content" },
  ...(FRETFLOW_ENABLED
    ? [{ id: "fretflow", label: "FretFlow", to: "/fretflow" }]
    : []),
];

export const contentTabs = [
  { id: "news", label: "News", kicker: "Fresh stream" },
];

export const defaultWidgets = {
  github: {
    owner: "DanN-55",
    profileUrl: "",
  },
  favorites: {
    title: "Favorites",
    channel: "all",
  },
  weather: {
    title: "Weather",
    locationQuery: "",
  },
  stock: {
    title: "A股概览",
    symbols: "贵州茅台,宁德时代,000001",
  },
};

export const MAX_STOCK_WIDGET_ITEMS = 8;
