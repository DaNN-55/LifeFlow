const { formatDateKey } = require("../lib/date");

class MemoryStore {
  constructor() {
    this.tasksByUser = new Map();
    this.dailyRecordsByUser = new Map();
    this.weeklySummariesByUser = new Map();
    this.contentSourcesByUser = new Map();
    this.contentItemsByUser = new Map();
    this.usersByUsername = new Map();
    this.sessionsById = new Map();
    this.schemaMode = "user-scoped";
  }

  async init() {
    return this;
  }

  ensureUserScope(userId = "") {
    if (!this.tasksByUser.has(userId)) {
      this.tasksByUser.set(userId, new Map());
    }
    if (!this.dailyRecordsByUser.has(userId)) {
      this.dailyRecordsByUser.set(userId, new Map());
    }
    if (!this.weeklySummariesByUser.has(userId)) {
      this.weeklySummariesByUser.set(userId, new Map());
    }
    if (!this.contentSourcesByUser.has(userId)) {
      this.contentSourcesByUser.set(userId, new Map());
    }
    if (!this.contentItemsByUser.has(userId)) {
      this.contentItemsByUser.set(userId, new Map());
    }

    return {
      tasks: this.tasksByUser.get(userId),
      dailyRecords: this.dailyRecordsByUser.get(userId),
      weeklySummaries: this.weeklySummariesByUser.get(userId),
      contentSources: this.contentSourcesByUser.get(userId),
      contentItems: this.contentItemsByUser.get(userId),
    };
  }

  async listTasks(scope = {}) {
    const { tasks } = this.ensureUserScope(scope.userId);
    return [...tasks.values()].sort((left, right) => left.display_order - right.display_order);
  }

  async createTask(scope = {}, task) {
    const { tasks } = this.ensureUserScope(scope.userId);
    tasks.set(task.id, task);
    return task;
  }

  async updateTask(scope = {}, taskId, patch) {
    const { tasks } = this.ensureUserScope(scope.userId);
    const existing = tasks.get(taskId);
    if (!existing) {
      return null;
    }
    const next = { ...existing };
    Object.entries(patch).forEach(([key, value]) => {
      if (typeof value !== "undefined") {
        next[key] = value;
      }
    });
    tasks.set(taskId, next);
    return next;
  }

  async deleteTask(scope = {}, taskId) {
    const { tasks, dailyRecords } = this.ensureUserScope(scope.userId);
    tasks.delete(taskId);
    for (const [date, record] of dailyRecords.entries()) {
      if (record.payload?.tasks?.[taskId]) {
        delete record.payload.tasks[taskId];
        dailyRecords.set(date, { ...record, updatedAt: new Date().toISOString() });
      }
    }
  }

  async getDailyRecord(scope = {}, date) {
    const { dailyRecords } = this.ensureUserScope(scope.userId);
    const key = formatDateKey(new Date(date));
    return dailyRecords.get(key) || null;
  }

  async upsertDailyRecord(scope = {}, date, payload) {
    const { dailyRecords } = this.ensureUserScope(scope.userId);
    const key = formatDateKey(new Date(date));
    const record = {
      date: key,
      payload,
      updatedAt: new Date().toISOString(),
    };
    dailyRecords.set(key, record);
    return record;
  }

  async listDailyRecordsBetween(scope = {}, startDate, endDate) {
    const { dailyRecords } = this.ensureUserScope(scope.userId);
    const start = formatDateKey(new Date(startDate));
    const end = formatDateKey(new Date(endDate));
    return [...dailyRecords.values()]
      .filter((record) => record.date >= start && record.date <= end)
      .sort((left, right) => left.date.localeCompare(right.date));
  }

  async getWeeklySummary(scope = {}, week) {
    const { weeklySummaries } = this.ensureUserScope(scope.userId);
    return weeklySummaries.get(week) || null;
  }

  async upsertWeeklySummary(scope = {}, week, payload) {
    const { weeklySummaries } = this.ensureUserScope(scope.userId);
    const summary = {
      week,
      content: payload.content || "",
      updatedAt: new Date().toISOString(),
    };
    weeklySummaries.set(week, summary);
    return summary;
  }

  async findUserByUsername(username) {
    return this.usersByUsername.get(username) || null;
  }

  async getUserById(userId) {
    return [...this.usersByUsername.values()].find((entry) => entry.id === userId) || null;
  }

  async createUser(user) {
    const next = {
      ...user,
      preferences: user.preferences && typeof user.preferences === "object" ? user.preferences : {},
    };
    this.usersByUsername.set(next.username, next);
    return next;
  }

  async updateUserPassword(userId, passwordHash) {
    const user = await this.getUserById(userId);
    if (!user) {
      return null;
    }
    const next = { ...user, password_hash: passwordHash };
    this.usersByUsername.set(next.username, next);
    return next;
  }

  async updateUserPreferences(userId, preferences) {
    const user = await this.getUserById(userId);
    if (!user) {
      return null;
    }
    const next = {
      ...user,
      preferences: preferences && typeof preferences === "object" ? preferences : {},
    };
    this.usersByUsername.set(next.username, next);
    return next;
  }

  async getAccountProfile(userId) {
    const user = await this.getUserById(userId);
    if (!user) {
      return null;
    }
    const scope = this.ensureUserScope(userId);
    return {
      user: {
        id: user.id,
        username: user.username,
        preferences: user.preferences || {},
        created_at: user.created_at || "",
      },
      counts: {
        tasks: scope.tasks.size,
        dailyRecords: scope.dailyRecords.size,
        weeklySummaries: scope.weeklySummaries.size,
      },
    };
  }

  async listUsers() {
    return [...this.usersByUsername.values()].map((user) => ({
      id: user.id,
      username: user.username,
      preferences: user.preferences || {},
      created_at: user.created_at || "",
    }));
  }

  async listContentSources(scope = {}, channel = "") {
    const { contentSources } = this.ensureUserScope(scope.userId);
    return [...contentSources.values()]
      .filter((source) => (!channel ? true : source.channel === channel))
      .sort((left, right) => {
        const byOrder = Number(left.sort_order || 0) - Number(right.sort_order || 0);
        if (byOrder !== 0) {
          return byOrder;
        }
        return String(left.name || "").localeCompare(String(right.name || ""), "zh-CN");
      });
  }

  async createContentSource(scope = {}, source) {
    const { contentSources } = this.ensureUserScope(scope.userId);
    contentSources.set(source.id, source);
    return source;
  }

  async updateContentSource(scope = {}, sourceId, patch) {
    const { contentSources } = this.ensureUserScope(scope.userId);
    const existing = contentSources.get(sourceId);
    if (!existing) {
      return null;
    }
    const next = { ...existing };
    Object.entries(patch).forEach(([key, value]) => {
      if (typeof value !== "undefined") {
        next[key] = value;
      }
    });
    next.updated_at = new Date().toISOString();
    contentSources.set(sourceId, next);
    return next;
  }

  async deleteContentSource(scope = {}, sourceId) {
    const { contentSources, contentItems } = this.ensureUserScope(scope.userId);
    contentSources.delete(sourceId);
    for (const [itemId, item] of contentItems.entries()) {
      if (item.source_id === sourceId) {
        contentItems.delete(itemId);
      }
    }
  }

  async getContentSource(scope = {}, sourceId) {
    const { contentSources } = this.ensureUserScope(scope.userId);
    return contentSources.get(sourceId) || null;
  }

  async upsertContentItems(scope = {}, items = []) {
    const { contentItems } = this.ensureUserScope(scope.userId);
    const persisted = [];
    for (const item of items) {
      const dedupeKey = `${item.channel}::${item.canonical_url}`;
      const existing = [...contentItems.values()].find(
        (entry) => `${entry.channel}::${entry.canonical_url}` === dedupeKey,
      );
      const next = existing
        ? { ...existing, ...item, id: existing.id, updated_at: new Date().toISOString() }
        : item;
      contentItems.set(next.id, next);
      persisted.push(next);
    }
    return persisted;
  }

  async listContent(scope = {}, filters = {}) {
    const { contentItems } = this.ensureUserScope(scope.userId);
    const page = Math.max(1, Number(filters.page || 1));
    const pageSize = Math.max(1, Math.min(50, Number(filters.pageSize || 20)));
    const q = String(filters.q || "").trim().toLowerCase();
    const tag = String(filters.tag || "").trim();
    const sourceId = String(filters.sourceId || "").trim();
    const sort = String(filters.sort || "latest");
    const channel = String(filters.channel || "").trim();

    let items = [...contentItems.values()].filter((item) =>
      channel ? item.channel === channel : true,
    );

    if (q) {
      items = items.filter((item) =>
        [item.title, item.summary_zh, item.summary_raw, item.body_zh, item.body_raw, item.source_name, item.author]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    if (tag) {
      items = items.filter((item) => Array.isArray(item.tags) && item.tags.includes(tag));
    }
    if (sourceId) {
      items = items.filter((item) => item.source_id === sourceId);
    }

    items.sort((left, right) => {
      const leftTime = new Date(left.published_at || left.fetched_at || 0).getTime();
      const rightTime = new Date(right.published_at || right.fetched_at || 0).getTime();
      return sort === "oldest" ? leftTime - rightTime : rightTime - leftTime;
    });

    const total = items.length;
    const start = (page - 1) * pageSize;
    return {
      items: items.slice(start, start + pageSize),
      total,
      page,
      pageSize,
    };
  }

  async listContentFacets(scope = {}, channel = "") {
    const { contentItems, contentSources } = this.ensureUserScope(scope.userId);
    const items = [...contentItems.values()].filter((item) => (channel ? item.channel === channel : true));
    const tags = [...new Set(items.flatMap((item) => (Array.isArray(item.tags) ? item.tags : [])))].sort();
    const sources = [...contentSources.values()]
      .filter((source) => (!channel ? true : source.channel === channel))
      .map((source) => ({
        id: source.id,
        name: source.name,
      }));
    return { tags, sources };
  }

  async getFeaturedContent(scope = {}, channel = "", limit = 3) {
    const result = await this.listContent(scope, {
      channel,
      page: 1,
      pageSize: Math.max(1, limit),
      sort: "latest",
    });
    return result.items.slice(0, limit);
  }

  async getContentItem(scope = {}, itemId) {
    const { contentItems } = this.ensureUserScope(scope.userId);
    return contentItems.get(itemId) || null;
  }

  async createSession(session) {
    this.sessionsById.set(session.id, session);
    return session;
  }

  async getSessionWithUser(sessionId) {
    const session = this.sessionsById.get(sessionId);
    if (!session) {
      return null;
    }
    const user = [...this.usersByUsername.values()].find(
      (entry) => entry.id === session.user_id,
    );
    if (!user) {
      this.sessionsById.delete(sessionId);
      return null;
    }
    return { session, user };
  }

  async deleteSession(sessionId) {
    this.sessionsById.delete(sessionId);
  }

  async clearUserData(userId) {
    this.tasksByUser.set(userId, new Map());
    this.dailyRecordsByUser.set(userId, new Map());
    this.weeklySummariesByUser.set(userId, new Map());
    this.contentSourcesByUser.set(userId, new Map());
    this.contentItemsByUser.set(userId, new Map());
  }

  async deleteUserAccount(userId) {
    const user = await this.getUserById(userId);
    if (!user) {
      return;
    }
    await this.clearUserData(userId);
    this.usersByUsername.delete(user.username);
    for (const [sessionId, session] of this.sessionsById.entries()) {
      if (session?.user_id === userId) {
        this.sessionsById.delete(sessionId);
      }
    }
  }
}

module.exports = { MemoryStore };
