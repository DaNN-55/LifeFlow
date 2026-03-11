const { formatDateKey } = require("../lib/date");

class MemoryStore {
  constructor() {
    this.tasksByUser = new Map();
    this.dailyRecordsByUser = new Map();
    this.weeklySummariesByUser = new Map();
    this.usersByUsername = new Map();
    this.sessionsById = new Map();
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

    return {
      tasks: this.tasksByUser.get(userId),
      dailyRecords: this.dailyRecordsByUser.get(userId),
      weeklySummaries: this.weeklySummariesByUser.get(userId),
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
    this.usersByUsername.set(user.username, user);
    return user;
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
        created_at: user.created_at || "",
      },
      counts: {
        tasks: scope.tasks.size,
        dailyRecords: scope.dailyRecords.size,
        weeklySummaries: scope.weeklySummaries.size,
      },
    };
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
