const { formatDateKey } = require("../lib/date");

function normalizePrimaryTag(tag) {
  const cleaned = String(tag || "").replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return "";
  }
  const [primary] = cleaned.split(/\s*\/\s*|\s*>\s*|\s*::\s*/);
  return String(primary || "").replace(/\s+/g, " ").trim();
}

function normalizeTagList(tags = []) {
  const values = Array.isArray(tags) ? tags : [tags];
  return [...new Set(values.map((tag) => normalizePrimaryTag(tag)).filter(Boolean))].slice(0, 8);
}

function itemHasPrimaryTag(item, tag) {
  const normalizedTag = normalizePrimaryTag(tag);
  if (!normalizedTag) {
    return true;
  }
  return normalizeTagList(item?.tags || []).includes(normalizedTag);
}

function normalizeContentItem(item = {}) {
  return {
    ...item,
    tags: normalizeTagList(item.tags || []),
  };
}

class MemoryStore {
  constructor({ now = () => new Date().toISOString() } = {}) {
    this.now = now;
    this.tasksByUser = new Map();
    this.dailyRecordsByUser = new Map();
    this.weeklySummariesByUser = new Map();
    this.contentSourcesByUser = new Map();
    this.contentItemsByUser = new Map();
    this.contentFavoritesByUser = new Map();
    this.usersByUsername = new Map();
    this.sessionsById = new Map();
    this.syncVersionQueuesByUser = new Map();
    this.schemaMode = "user-scoped";
  }

  getNowIso() {
    return this.now();
  }

  async touchUserSyncState(userId, options = {}) {
    return this.confirmUserFact(userId, options, (state) => state);
  }

  async confirmUserFact(userId, options = {}, confirm = () => undefined) {
    return this.runInUserSyncQueue(userId, async () => {
      const state = await this.advanceUserSyncState(userId, options);
      return confirm(state);
    });
  }

  async runInUserSyncQueue(userId, operation) {
    const previous = this.syncVersionQueuesByUser.get(userId) || Promise.resolve();
    const queued = previous.catch(() => undefined).then(operation);
    this.syncVersionQueuesByUser.set(userId, queued);
    try {
      return await queued;
    } finally {
      if (this.syncVersionQueuesByUser.get(userId) === queued) {
        this.syncVersionQueuesByUser.delete(userId);
      }
    }
  }

  async advanceUserSyncState(userId, options = {}) {
    const user = await this.getUserById(userId);
    if (!user) {
      return { dataSyncVersion: 0, dataResetVersion: 0 };
    }

    const now = this.getNowIso();
    const nextVersion = Number(user.data_sync_version || 0) + 1;
    const next = {
      ...user,
      data_updated_at: now,
      data_reset_at: options.reset ? now : user.data_reset_at || "",
      data_sync_version: nextVersion,
      data_reset_version: options.reset ? nextVersion : Number(user.data_reset_version || 0),
    };
    this.usersByUsername.set(next.username, next);
    return { dataSyncVersion: nextVersion, dataResetVersion: next.data_reset_version };
  }

  isWithinSyncRange(value, since = null, upper = null) {
    const version = Number(value || 0);
    return (since === null || version > since) && (upper === null || version <= upper);
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
    if (!this.contentFavoritesByUser.has(userId)) {
      this.contentFavoritesByUser.set(userId, new Map());
    }

    return {
      tasks: this.tasksByUser.get(userId),
      dailyRecords: this.dailyRecordsByUser.get(userId),
      weeklySummaries: this.weeklySummariesByUser.get(userId),
      contentSources: this.contentSourcesByUser.get(userId),
      contentItems: this.contentItemsByUser.get(userId),
      contentFavorites: this.contentFavoritesByUser.get(userId),
    };
  }

  async listTasks(scope = {}, { upperVersion = null } = {}) {
    const { tasks } = this.ensureUserScope(scope.userId);
    return [...tasks.values()]
      .filter((task) => this.isWithinSyncRange(task.sync_version, null, upperVersion))
      .sort((left, right) => (left.display_order - right.display_order) || String(left.id).localeCompare(String(right.id)));
  }

  async createTask(scope = {}, task) {
    const { tasks } = this.ensureUserScope(scope.userId);
    const next = {
      ...task,
      updated_at: task.updated_at || this.getNowIso(),
    };
    return this.confirmUserFact(scope.userId, {}, (state) => {
      next.sync_version = state.dataSyncVersion;
      tasks.set(next.id, next);
      return next;
    });
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
    next.updated_at = this.getNowIso();
    return this.confirmUserFact(scope.userId, {}, (state) => {
      next.sync_version = state.dataSyncVersion;
      tasks.set(taskId, next);
      return next;
    });
  }

  async deleteTask(scope = {}, taskId) {
    const { tasks, dailyRecords } = this.ensureUserScope(scope.userId);
    return this.confirmUserFact(scope.userId, { reset: true }, () => {
      tasks.delete(taskId);
      for (const [date, record] of dailyRecords.entries()) {
        if (record.payload?.tasks?.[taskId]) {
          delete record.payload.tasks[taskId];
          dailyRecords.set(date, { ...record, updatedAt: this.getNowIso() });
        }
      }
    });
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
      updatedAt: this.getNowIso(),
    };
    return this.confirmUserFact(scope.userId, {}, (state) => {
      record.sync_version = state.dataSyncVersion;
      dailyRecords.set(key, record);
      return record;
    });
  }

  async listDailyRecordsBetween(scope = {}, startDate, endDate) {
    const { dailyRecords } = this.ensureUserScope(scope.userId);
    const start = formatDateKey(new Date(startDate));
    const end = formatDateKey(new Date(endDate));
    return [...dailyRecords.values()]
      .filter((record) => record.date >= start && record.date <= end)
      .sort((left, right) => left.date.localeCompare(right.date));
  }

  async listDailyRecords(scope = {}, { upperVersion = null } = {}) {
    const { dailyRecords } = this.ensureUserScope(scope.userId);
    return [...dailyRecords.values()]
      .filter((record) => this.isWithinSyncRange(record.sync_version, null, upperVersion))
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
      updatedAt: this.getNowIso(),
    };
    return this.confirmUserFact(scope.userId, {}, (state) => {
      summary.sync_version = state.dataSyncVersion;
      weeklySummaries.set(week, summary);
      return summary;
    });
  }

  async listWeeklySummaries(scope = {}, { upperVersion = null } = {}) {
    const { weeklySummaries } = this.ensureUserScope(scope.userId);
    return [...weeklySummaries.values()]
      .filter((summary) => this.isWithinSyncRange(summary.sync_version, null, upperVersion))
      .sort((left, right) => left.week.localeCompare(right.week));
  }

  async listTasksUpdatedSince(scope = {}, since, upperVersion = null) {
    return (await this.listTasks(scope, { upperVersion })).filter((task) =>
      this.isWithinSyncRange(task.sync_version, since, upperVersion),
    );
  }

  async listDailyRecordsUpdatedSince(scope = {}, since, upperVersion = null) {
    return (await this.listDailyRecords(scope, { upperVersion })).filter((record) =>
      this.isWithinSyncRange(record.sync_version, since, upperVersion),
    );
  }

  async listWeeklySummariesUpdatedSince(scope = {}, since, upperVersion = null) {
    return (await this.listWeeklySummaries(scope, { upperVersion })).filter((summary) =>
      this.isWithinSyncRange(summary.sync_version, since, upperVersion),
    );
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
      data_updated_at: user.data_updated_at || this.getNowIso(),
      data_reset_at: user.data_reset_at || "",
      data_sync_version: Number(user.data_sync_version || 0),
      data_reset_version: Number(user.data_reset_version || 0),
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

  async updateUserRecoveryCode(userId, recoveryCodeHash) {
    const user = await this.getUserById(userId);
    if (!user) {
      return null;
    }
    const next = { ...user, recovery_code_hash: recoveryCodeHash };
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

  async updateUserUsername(userId, username) {
    const user = await this.getUserById(userId);
    if (!user) {
      return null;
    }
    this.usersByUsername.delete(user.username);
    const next = { ...user, username };
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
        data_updated_at: user.data_updated_at || "",
        data_reset_at: user.data_reset_at || "",
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
      data_updated_at: user.data_updated_at || "",
      data_reset_at: user.data_reset_at || "",
    }));
  }

  async listContentSources(scope = {}, channel = "", { upperVersion = null } = {}) {
    const { contentSources } = this.ensureUserScope(scope.userId);
    return [...contentSources.values()]
      .filter((source) => (!channel ? true : source.channel === channel))
      .filter((source) => this.isWithinSyncRange(source.sync_version, null, upperVersion))
      .sort((left, right) => {
        const byOrder = Number(left.sort_order || 0) - Number(right.sort_order || 0);
        if (byOrder !== 0) {
          return byOrder;
        }
        return String(left.name || "").localeCompare(String(right.name || ""), "zh-CN") || String(left.id).localeCompare(String(right.id));
      });
  }

  async createContentSource(scope = {}, source) {
    const { contentSources } = this.ensureUserScope(scope.userId);
    const duplicateSource = [...contentSources.values()].find((entry) =>
      entry.channel === source.channel &&
      entry.type === source.type &&
      entry.url === source.url &&
      String(entry.parser_key || "") === String(source.parser_key || ""),
    );
    if (duplicateSource) {
      return duplicateSource;
    }
    const next = {
      last_synced_at: "",
      last_success_at: "",
      last_failure_at: "",
      last_error: "",
      latest_published_at: "",
      ...source,
    };
    return this.confirmUserFact(scope.userId, {}, (state) => {
      next.sync_version = state.dataSyncVersion;
      contentSources.set(next.id, next);
      return next;
    });
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
    return this.confirmUserFact(scope.userId, {}, (state) => {
      next.sync_version = state.dataSyncVersion;
      contentSources.set(sourceId, next);
      return next;
    });
  }

  async updateContentSourceSync(scope = {}, sourceId, patch = {}) {
    const { contentSources } = this.ensureUserScope(scope.userId);
    const existing = contentSources.get(sourceId);
    if (!existing) {
      return null;
    }
    const next = {
      ...existing,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    return this.confirmUserFact(scope.userId, {}, (state) => {
      next.sync_version = state.dataSyncVersion;
      contentSources.set(sourceId, next);
      return next;
    });
  }

  async deleteContentSource(scope = {}, sourceId) {
    const { contentSources, contentItems } = this.ensureUserScope(scope.userId);
    const targetSource = contentSources.get(sourceId);
    if (!targetSource) {
      return;
    }
    const sourceIds = [...contentSources.values()]
      .filter((entry) =>
        entry.channel === targetSource.channel &&
        entry.type === targetSource.type &&
        entry.url === targetSource.url &&
        String(entry.parser_key || "") === String(targetSource.parser_key || ""),
      )
      .map((entry) => entry.id);
    return this.confirmUserFact(scope.userId, { reset: true }, () => {
      for (const id of sourceIds) contentSources.delete(id);
      for (const [itemId, item] of contentItems.entries()) {
        if (sourceIds.includes(item.source_id)) contentItems.delete(itemId);
      }
    });
  }

  async getContentSource(scope = {}, sourceId) {
    const { contentSources } = this.ensureUserScope(scope.userId);
    return contentSources.get(sourceId) || null;
  }

  async listContentSourcesUpdatedSince(scope = {}, since, upperVersion = null) {
    return (await this.listContentSources(scope, "", { upperVersion })).filter((source) =>
      this.isWithinSyncRange(source.sync_version, since, upperVersion),
    );
  }

  async upsertContentItems(scope = {}, items = []) {
    const { contentItems } = this.ensureUserScope(scope.userId);
    if (!items.length) return [];
    return this.confirmUserFact(scope.userId, {}, (state) => items.map((item) => {
      const dedupeKey = `${item.channel}::${item.canonical_url}`;
      const existing = [...contentItems.values()].find((entry) => `${entry.channel}::${entry.canonical_url}` === dedupeKey);
      const next = existing
        ? normalizeContentItem({ ...existing, ...item, id: existing.id, updated_at: new Date().toISOString() })
        : normalizeContentItem(item);
      next.sync_version = state.dataSyncVersion;
      contentItems.set(next.id, next);
      return next;
    }));
  }

  async replaceContentItems(scope = {}, channel = "", items = []) {
    const { contentItems } = this.ensureUserScope(scope.userId);
    const removed = [...contentItems.values()].some((item) => !channel || item.channel === channel);
    if (removed) await this.confirmUserFact(scope.userId, { reset: true }, () => {
      for (const [itemId, item] of contentItems.entries()) if (!channel || item.channel === channel) contentItems.delete(itemId);
    });
    return this.upsertContentItems(scope, items);
  }

  async pruneExpiredContentItems(scope = {}, options = {}) {
    const { contentItems } = this.ensureUserScope(scope.userId);
    const cutoffIso = String(options.cutoffIso || "").trim();
    const cutoffTime = new Date(cutoffIso).getTime();
    const channel = String(options.channel || "").trim();
    const sourceIds = Array.isArray(options.sourceIds) ? new Set(options.sourceIds.map(String)) : null;

    if (Number.isNaN(cutoffTime)) {
      return 0;
    }

    const removableIds = [];
    for (const [itemId, item] of contentItems.entries()) {
      if (channel && item.channel !== channel) {
        continue;
      }
      if (sourceIds && !sourceIds.has(String(item.source_id || ""))) {
        continue;
      }
      const itemTime = new Date(item.published_at || item.fetched_at || item.created_at || 0).getTime();
      if (Number.isNaN(itemTime) || itemTime >= cutoffTime) {
        continue;
      }
      removableIds.push(itemId);
    }
    if (removableIds.length) await this.confirmUserFact(scope.userId, { reset: true }, () => {
      removableIds.forEach((itemId) => contentItems.delete(itemId));
    });
    return removableIds.length;
  }

  async listContent(scope = {}, filters = {}) {
    const { contentItems } = this.ensureUserScope(scope.userId);
    const page = Math.max(1, Number(filters.page || 1));
    const pageSize = Math.max(1, Number(filters.pageSize || 20));
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
        [item.title, item.summary_zh, item.summary_raw, item.source_name, item.author]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    if (tag) {
      items = items.filter((item) => itemHasPrimaryTag(item, tag));
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
      items: items.slice(start, start + pageSize).map((item) => normalizeContentItem(item)),
      total,
      page,
      pageSize,
    };
  }

  async listContentUpdatedSince(scope = {}, since, channel = "", upperVersion = null) {
    const { contentItems } = this.ensureUserScope(scope.userId);
    const items = [...contentItems.values()]
      .filter((item) => (!channel ? true : item.channel === channel))
      .filter((item) => this.isWithinSyncRange(item.sync_version, since, upperVersion))
      .map((item) => normalizeContentItem(item))
      .sort((left, right) => {
        const leftTime = new Date(left.updated_at || left.fetched_at || left.created_at || 0).getTime();
        const rightTime = new Date(right.updated_at || right.fetched_at || right.created_at || 0).getTime();
        return (rightTime - leftTime) || String(left.id).localeCompare(String(right.id));
      });
    return items;
  }

  async listContentFacets(scope = {}, channel = "") {
    const { contentItems, contentSources } = this.ensureUserScope(scope.userId);
    const items = [...contentItems.values()].filter((item) => (channel ? item.channel === channel : true));
    const tags = [...new Set(items.flatMap((item) => normalizeTagList(item.tags || [])))].sort();
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

  async listFavoriteContent(scope = {}, filters = {}) {
    const { contentFavorites } = this.ensureUserScope(scope.userId);
    const page = Math.max(1, Number(filters.page || 1));
    const pageSize = Math.max(1, Number(filters.pageSize || 20));
    const q = String(filters.q || "").trim().toLowerCase();
    const tag = String(filters.tag || "").trim();
    const sourceId = String(filters.sourceId || "").trim();
    const sort = String(filters.sort || "latest");
    const channel = String(filters.channel || "").trim();

    let items = [...contentFavorites.values()].filter((item) => (channel ? item.channel === channel : true));

    if (q) {
      items = items.filter((item) =>
        [item.title, item.summary_zh, item.summary_raw, item.source_name, item.author]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    if (tag) {
      items = items.filter((item) => itemHasPrimaryTag(item, tag));
    }
    if (sourceId) {
      items = items.filter((item) => item.source_id === sourceId);
    }

    items.sort((left, right) => {
      const leftTime = new Date(left.published_at || left.favorited_at || 0).getTime();
      const rightTime = new Date(right.published_at || right.favorited_at || 0).getTime();
      return sort === "oldest" ? leftTime - rightTime : rightTime - leftTime;
    });

    const total = items.length;
    const start = (page - 1) * pageSize;
    return {
      items: items.slice(start, start + pageSize).map((item) => ({ ...normalizeContentItem(item), is_favorite: true })),
      total,
      page,
      pageSize,
    };
  }

  async listFavoriteContentUpdatedSince(scope = {}, since, channel = "", upperVersion = null) {
    const { contentFavorites } = this.ensureUserScope(scope.userId);
    const items = [...contentFavorites.values()]
      .filter((item) => (!channel ? true : item.channel === channel))
      .filter((item) => this.isWithinSyncRange(item.sync_version, since, upperVersion))
      .map((item) => ({ ...normalizeContentItem(item), is_favorite: true }))
      .sort((left, right) => {
        const leftTime = new Date(left.updated_at || left.favorited_at || left.created_at || 0).getTime();
        const rightTime = new Date(right.updated_at || right.favorited_at || right.created_at || 0).getTime();
        return (rightTime - leftTime) || String(left.id).localeCompare(String(right.id));
      });
    return items;
  }

  async listFavoriteContentFacets(scope = {}, channel = "") {
    const { contentFavorites, contentSources } = this.ensureUserScope(scope.userId);
    const items = [...contentFavorites.values()].filter((item) => (channel ? item.channel === channel : true));
    const tags = [...new Set(items.flatMap((item) => normalizeTagList(item.tags || [])))].sort();
    const sourceIds = new Set(items.map((item) => item.source_id).filter(Boolean));
    const sources = [...contentSources.values()]
      .filter((source) => (!channel ? true : source.channel === channel))
      .filter((source) => sourceIds.size === 0 || sourceIds.has(source.id))
      .map((source) => ({ id: source.id, name: source.name }));
    return { tags, sources };
  }

  async listFavoriteContentUrls(scope = {}, channel = "") {
    const { contentFavorites } = this.ensureUserScope(scope.userId);
    return [...contentFavorites.values()]
      .filter((item) => (!channel ? true : item.channel === channel))
      .map((item) => item.canonical_url)
      .filter(Boolean);
  }

  async getFavoriteContentItem(scope = {}, itemId) {
    const { contentFavorites } = this.ensureUserScope(scope.userId);
    const item = contentFavorites.get(itemId) || null;
    return item ? { ...normalizeContentItem(item), is_favorite: true } : null;
  }

  async upsertFavoriteContent(scope = {}, item) {
    const { contentFavorites } = this.ensureUserScope(scope.userId);
    const existing = [...contentFavorites.values()].find(
      (entry) => entry.channel === item.channel && entry.canonical_url === item.canonical_url,
    );
    const next = {
      ...(existing || {}),
      ...normalizeContentItem(item),
      id: existing?.id || item.id,
      favorited_at: existing?.favorited_at || item.favorited_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_favorite: true,
    };
    return this.confirmUserFact(scope.userId, {}, (state) => {
      next.sync_version = state.dataSyncVersion;
      contentFavorites.set(next.id, next);
      return next;
    });
  }

  async deleteFavoriteContent(scope = {}, channel, canonicalUrl) {
    const { contentFavorites } = this.ensureUserScope(scope.userId);
    return this.confirmUserFact(scope.userId, { reset: true }, () => {
      for (const [itemId, item] of contentFavorites.entries()) {
        if (item.channel === channel && item.canonical_url === canonicalUrl) contentFavorites.delete(itemId);
      }
    });
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

  async deleteSessionsByUser(userId) {
    for (const [sessionId, session] of this.sessionsById.entries()) {
      if (session?.user_id === userId) {
        this.sessionsById.delete(sessionId);
      }
    }
  }

  async clearUserData(userId) {
    return this.confirmUserFact(userId, { reset: true }, () => {
      const scope = this.ensureUserScope(userId);
      scope.tasks.clear();
      scope.dailyRecords.clear();
      scope.weeklySummaries.clear();
      scope.contentSources.clear();
      scope.contentItems.clear();
      scope.contentFavorites.clear();
    });
  }

  async readStateContinuityProjection(userId, { since = null } = {}) {
    return this.runInUserSyncQueue(userId, async () => {
      const syncState = await this.getUserSyncState(userId);
      const upperVersion = Number(syncState?.dataSyncVersion || 0);
      const full = Promise.all([
          this.listTasks({ userId }, { upperVersion }),
          this.listDailyRecords({ userId }, { upperVersion }),
          this.listWeeklySummaries({ userId }, { upperVersion }),
          this.listContentSources({ userId }, "", { upperVersion }),
          this.listContentUpdatedSince({ userId }, null, "", upperVersion),
          this.listFavoriteContentUpdatedSince({ userId }, null, "", upperVersion),
      ]);
      const changed = since === null ? full : Promise.all([
          this.listTasksUpdatedSince({ userId }, since, upperVersion),
          this.listDailyRecordsUpdatedSince({ userId }, since, upperVersion),
          this.listWeeklySummariesUpdatedSince({ userId }, since, upperVersion),
          this.listContentSourcesUpdatedSince({ userId }, since, upperVersion),
          this.listContentUpdatedSince({ userId }, since, "", upperVersion),
          this.listFavoriteContentUpdatedSince({ userId }, since, "", upperVersion),
      ]);
      const [fullFacts, changedFacts] = await Promise.all([full, changed]);
      const clean = (item) => {
        const copy = { ...item };
        delete copy.sync_version;
        delete copy.user_id;
        return copy;
      };
      const asProjection = ([tasks, dailyRecords, weeklySummaries, sources, items, favorites]) =>
        ({ tasks: tasks.map(clean), dailyRecords: dailyRecords.map(clean), weeklySummaries: weeklySummaries.map(clean), content: { sources: sources.map(clean), items: items.map(clean), favorites: favorites.map(clean) } });
      return { syncState, upperVersion, snapshot: asProjection(fullFacts), changes: asProjection(changedFacts) };
    });
  }

  async getUserSyncState(userId) {
    const user = await this.getUserById(userId);
    if (!user) {
      return null;
    }
    return {
      dataUpdatedAt: user.data_updated_at || user.created_at || "",
      dataResetAt: user.data_reset_at || "",
      dataSyncVersion: Number(user.data_sync_version || 0),
      dataResetVersion: Number(user.data_reset_version || 0),
    };
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
