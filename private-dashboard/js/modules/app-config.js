export const STORAGE_KEY = "lifeflow-private-dashboard-v1";
export const STORAGE_VERSION = 6;
export const API_BASE_STORAGE_KEY = "lifeflow-private-dashboard-api-base";
export const API_SEED_PREFIX = "lifeflow-private-dashboard-seeded:";
export const DEFAULT_REMOTE_API_BASE = "https://lifeflow-backend-mrs1.onrender.com";
export const AUTH_CONFIG_STORAGE_KEY = "lifeflow-private-dashboard-auth-config";
export const SESSION_STORAGE_KEY = "lifeflow-private-dashboard-session";
export const PENDING_SYNC_STORAGE_KEY = "lifeflow-private-dashboard-pending-sync";
export const WEATHER_CACHE_STORAGE_KEY = "lifeflow-private-dashboard-weather-cache";
export const API_PROBE_TIMEOUT_MS = 1500;
export const LOCAL_SCOPE_KEY = "__local__";
export const CONTENT_PAGE_SIZE = 10;

export const defaultTasks = [
  { id: "task1", name: "任务1", order: 1, color: "#4f46e5" },
  { id: "task2", name: "任务2", order: 2, color: "#0f766e" },
  { id: "task3", name: "任务3", order: 3, color: "#ca8a04" },
  { id: "task4", name: "任务4", order: 4, color: "#dc2626" },
];

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

export function createInitialContentChannelState(channel) {
  return {
    channel,
    items: [],
    featured: [],
    tags: [],
    sources: [],
    page: 1,
    total: 0,
    pageSize: CONTENT_PAGE_SIZE,
    search: "",
    tag: "all",
    sourceId: "all",
    favoriteFilter: "all",
    sort: "latest",
    loading: false,
    loaded: false,
    refreshing: false,
    autoRefreshed: false,
    usingMock: false,
    lastRefreshedAt: "",
    lastRefreshStats: null,
    error: "",
    meta: "",
  };
}
