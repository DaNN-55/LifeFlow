const { formatDateKey } = require("../lib/date");

const defaultTasks = [
  { id: "job", name: "找工作", color: "var(--job)", display_order: 1 },
  { id: "fitness", name: "健身", color: "var(--fitness)", display_order: 2 },
  { id: "guitar", name: "吉他", color: "var(--guitar)", display_order: 3 },
  { id: "arbitration", name: "仲裁", color: "var(--arbitration)", display_order: 4 },
];

class MemoryStore {
  constructor() {
    this.tasksByUser = new Map();
    this.dailyRecordsByUser = new Map();
  }

  async init() {
    return this;
  }

  ensureUserScope(userId = "public") {
    if (!this.tasksByUser.has(userId)) {
      this.tasksByUser.set(userId, new Map(defaultTasks.map((task) => [task.id, { ...task }])));
    }
    if (!this.dailyRecordsByUser.has(userId)) {
      this.dailyRecordsByUser.set(userId, new Map());
    }

    return {
      tasks: this.tasksByUser.get(userId),
      dailyRecords: this.dailyRecordsByUser.get(userId),
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
}

module.exports = { MemoryStore, defaultTasks };
