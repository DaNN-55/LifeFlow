export const DEMO_STORAGE_KEY = "lifeflow-private-dashboard-demo-state-v1";

const DEMO_VERSION = 1;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function formatWeek(date) {
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = target.getDay() || 7;
  target.setDate(target.getDate() + 4 - day);
  const yearStart = new Date(target.getFullYear(), 0, 1);
  const week = Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
  return `${target.getFullYear()}-W${pad(week)}`;
}

function createTaskState({ completed = false, notes = [] } = {}) {
  return {
    completed,
    notes: notes.map((note) => ({ ...note })),
  };
}

function createOnboardingState() {
  return {
    collapsed: false,
    executionRecorded: false,
    syntheticNewsFavorited: false,
    periodReviewOpened: false,
  };
}

function hasExecutionEvidence(payload = {}) {
  return Object.values(payload?.tasks || {}).some((taskState) => (
    Boolean(taskState?.completed)
    && Array.isArray(taskState?.notes)
    && taskState.notes.some((note) => String(note?.text || "").trim())
  ));
}

function createFixture(now) {
  const today = formatDate(now);
  const yesterday = formatDate(addDays(now, -1));
  const twoDaysAgo = formatDate(addDays(now, -2));
  const currentWeek = formatWeek(now);
  const createdAt = new Date(now).toISOString();
  const tasks = [
    {
      id: "demo-task-plan",
      name: "规划今日重点",
      color: "#64748b",
      display_order: 1,
      archived: false,
      archived_at: "",
      tags: ["执行"],
      icon: "task_alt",
    },
    {
      id: "demo-task-read",
      name: "阅读并整理资讯",
      color: "#94a3b8",
      display_order: 2,
      archived: false,
      archived_at: "",
      tags: ["输入"],
      icon: "menu_book",
    },
  ];
  const sources = {
    "demo-source-product": {
      id: "demo-source-product",
      channel: "news",
      name: "Product Notes",
      type: "rss",
      url: "",
      enabled: true,
      sort_order: 1,
    },
    "demo-source-tech": {
      id: "demo-source-tech",
      channel: "news",
      name: "Tech Briefing",
      type: "rss",
      url: "",
      enabled: true,
      sort_order: 2,
    },
  };
  const contentEntries = [
    ["demo-news-1", "从任务清单到执行闭环", "把目标拆成今日任务，并用记录与复盘持续校正。", "demo-source-product", "方法"],
    ["demo-news-2", "本地优先应用如何保持可靠", "缓存、增量同步和清晰的离线状态共同改善使用体验。", "demo-source-tech", "工程"],
    ["demo-news-3", "让周复盘真正连接下一步", "复盘不是总结文字，而是从执行证据中提炼下一轮行动。", "demo-source-product", "复盘"],
    ["demo-news-4", "信息流中的信源治理", "明确来源、刷新状态和失败反馈，才能让聚合内容可解释。", "demo-source-tech", "资讯"],
  ];
  const items = Object.fromEntries(contentEntries.map(([id, title, summary, sourceId, tag], index) => [
    id,
    {
      id,
      channel: "news",
      title,
      summary_zh: summary,
      body_zh: `${summary}\n\n这是 LifeFlow Demo 的合成内容，不对应真实文章或个人数据。`,
      source_id: sourceId,
      source_name: sources[sourceId].name,
      source_url: "",
      canonical_url: "",
      author: "LifeFlow Demo",
      published_at: new Date(now.getTime() - index * 3600000).toISOString(),
      fetched_at: createdAt,
      content_type: tag,
      tags: [tag, "Demo"],
      lang: "zh",
      is_favorite: false,
    },
  ]));

  return {
    version: DEMO_VERSION,
    tasks,
    dailyRecords: {
      [twoDaysAgo]: {
        date: twoDaysAgo,
        updatedAt: createdAt,
        payload: {
          tasks: {
            "demo-task-plan": createTaskState({ completed: true }),
            "demo-task-read": createTaskState(),
          },
        },
      },
      [yesterday]: {
        date: yesterday,
        updatedAt: createdAt,
        payload: {
          tasks: {
            "demo-task-plan": createTaskState({
              completed: true,
              notes: [{ id: "demo-note-1", text: "明确了今天最重要的一件事。", createdAt }],
            }),
            "demo-task-read": createTaskState({ completed: true }),
          },
        },
      },
      [today]: {
        date: today,
        updatedAt: createdAt,
        payload: {
          tasks: {
            "demo-task-plan": createTaskState(),
            "demo-task-read": createTaskState(),
          },
        },
      },
    },
    weeklySummaries: {
      [currentWeek]: {
        week: currentWeek,
        content: "",
        updatedAt: "",
      },
    },
    // Fixture history illustrates the product, but deliberately does not count
    // as the visitor's own onboarding progress.
    onboarding: createOnboardingState(),
    content: {
      items: { news: items },
      sources: { news: sources },
      favorites: { news: {} },
      readItems: {},
    },
    home: {
      weather: {
        status: "ready",
        location: "Demo 城市",
        temperature: "24°",
        detail: "晴间多云",
        message: "合成天气数据",
        forecast: [
          { date: today, min: 19, max: 27, weather: "晴" },
          { date: formatDate(addDays(now, 1)), min: 20, max: 28, weather: "多云" },
          { date: formatDate(addDays(now, 2)), min: 18, max: 25, weather: "小雨" },
        ],
        source: "LifeFlow Demo",
        updatedAt: createdAt,
        latitude: null,
        longitude: null,
      },
      github: {
        status: "ready",
        repos: [
          {
            name: "DaNN-55 / LifeFlow",
            description: "LifeFlow 公开仓库：把今日执行、周期复盘与信息输入放在同一条工作流中。",
            updatedAt: "",
            url: "https://github.com/DaNN-55/LifeFlow",
            shortUrl: "LifeFlow",
          },
        ],
        url: "https://github.com/DaNN-55/LifeFlow",
        message: "LifeFlow 公开仓库",
      },
      stock: {
        status: "idle",
        symbols: [],
        updatedAt: "",
        message: "Demo 模式不请求外部行情",
      },
    },
  };
}

function normalizeState(value, now) {
  if (!value || typeof value !== "object" || value.version !== DEMO_VERSION) {
    return createFixture(now);
  }
  return {
    ...value,
    onboarding: {
      ...createOnboardingState(),
      ...(value.onboarding || {}),
    },
  };
}

export function createDemoStateRepository({ storage = globalThis.localStorage, now = () => new Date() } = {}) {
  function read() {
    try {
      const raw = storage?.getItem(DEMO_STORAGE_KEY);
      return raw ? normalizeState(JSON.parse(raw), now()) : null;
    } catch {
      return null;
    }
  }

  function write(state) {
    storage?.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
    return clone(state);
  }

  function ensure() {
    const current = read();
    return current ? write(current) : write(createFixture(now()));
  }

  function update(mutator) {
    const state = ensure();
    mutator(state);
    return write(state);
  }

  return {
    ensure,
    load: ensure,
    reset() {
      return write(createFixture(now()));
    },
    clear() {
      storage?.removeItem(DEMO_STORAGE_KEY);
    },
    createTask({ name, tags = [], color = "#64748b", icon = "" }) {
      return update((state) => {
        const createdAt = now();
        const date = formatDate(createdAt);
        const id = `demo-task-${createdAt.getTime()}`;
        state.tasks.push({
          id,
          name: String(name || "").trim(),
          color,
          display_order: state.tasks.length + 1,
          archived: false,
          archived_at: "",
          tags: [...tags],
          icon,
        });
        state.dailyRecords[date] ||= { date, updatedAt: "", payload: { tasks: {} } };
        state.dailyRecords[date].payload.tasks[id] = createTaskState();
        state.dailyRecords[date].updatedAt = createdAt.toISOString();
      });
    },
    updateTask(taskId, changes = {}) {
      return update((state) => {
        const task = state.tasks.find((item) => item.id === taskId);
        if (!task) return;
        if (typeof changes.name === "string") task.name = changes.name;
        if (typeof changes.color === "string") task.color = changes.color;
        if (Number.isFinite(changes.displayOrder)) task.display_order = changes.displayOrder;
        if (typeof changes.archived === "boolean") task.archived = changes.archived;
        if ("archivedAt" in changes) task.archived_at = changes.archivedAt || "";
        if (Array.isArray(changes.lifecycleEvents)) task.lifecycle_events = [...changes.lifecycleEvents];
        if (Array.isArray(changes.tags)) task.tags = [...changes.tags];
        if (typeof changes.icon === "string") task.icon = changes.icon;
      });
    },
    deleteTask(taskId) {
      return update((state) => {
        state.tasks = state.tasks.filter((task) => task.id !== taskId);
        Object.values(state.dailyRecords).forEach((record) => {
          delete record?.payload?.tasks?.[taskId];
        });
      });
    },
    updateDailyRecord(date, payload) {
      return update((state) => {
        state.dailyRecords[date] = {
          date,
          updatedAt: now().toISOString(),
          payload: clone(payload),
        };
        if (hasExecutionEvidence(payload)) {
          state.onboarding.executionRecorded = true;
        }
      });
    },
    setOnboardingCollapsed(collapsed) {
      return update((state) => {
        state.onboarding.collapsed = Boolean(collapsed);
      });
    },
    markPeriodReviewOpened() {
      return update((state) => {
        state.onboarding.periodReviewOpened = true;
      });
    },
    saveWeeklySummary(week, content) {
      return update((state) => {
        state.weeklySummaries[week] = {
          week,
          content: String(content || "").trim(),
          updatedAt: now().toISOString(),
        };
      });
    },
    toggleFavorite(itemId) {
      return update((state) => {
        const item = state.content.items.news[itemId];
        if (!item) return;
        item.is_favorite = !item.is_favorite;
        if (item.is_favorite) {
          state.content.favorites.news[itemId] = { ...item, favorited_at: now().toISOString() };
          // This flag is deliberately set only after the repository has applied
          // a real favorite mutation to a synthetic item.
          state.onboarding.syntheticNewsFavorited = true;
        } else {
          delete state.content.favorites.news[itemId];
        }
      });
    },
    toggleRead(itemId) {
      return update((state) => {
        if (state.content.readItems[itemId]) {
          delete state.content.readItems[itemId];
        } else {
          state.content.readItems[itemId] = now().toISOString();
        }
      });
    },
    markRead(itemIds = []) {
      return update((state) => {
        const timestamp = now().toISOString();
        itemIds.forEach((itemId) => {
          if (state.content.items.news[itemId]) {
            state.content.readItems[itemId] = timestamp;
          }
        });
      });
    },
  };
}

export const demoState = createDemoStateRepository();
