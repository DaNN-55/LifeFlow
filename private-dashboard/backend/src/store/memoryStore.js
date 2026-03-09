const { formatDateKey } = require("../lib/date");

const defaultTasks = [
  { id: "job", name: "找工作", color: "var(--job)", display_order: 1 },
  { id: "fitness", name: "健身", color: "var(--fitness)", display_order: 2 },
  { id: "guitar", name: "吉他", color: "var(--guitar)", display_order: 3 },
  { id: "arbitration", name: "仲裁", color: "var(--arbitration)", display_order: 4 },
];

class MemoryStore {
  constructor() {
    this.tasks = new Map(defaultTasks.map((task) => [task.id, task]));
    this.dailyRecords = new Map();
  }

  async init() {
    return this;
  }

  async listTasks() {
    return [...this.tasks.values()].sort((left, right) => left.display_order - right.display_order);
  }

  async createTask(task) {
    this.tasks.set(task.id, task);
    return task;
  }

  async deleteTask(taskId) {
    this.tasks.delete(taskId);
    for (const [date, record] of this.dailyRecords.entries()) {
      if (record.payload?.tasks?.[taskId]) {
        delete record.payload.tasks[taskId];
        this.dailyRecords.set(date, { ...record, updatedAt: new Date().toISOString() });
      }
    }
  }

  async getDailyRecord(date) {
    const key = formatDateKey(new Date(date));
    return this.dailyRecords.get(key) || null;
  }

  async upsertDailyRecord(date, payload) {
    const key = formatDateKey(new Date(date));
    const record = {
      date: key,
      payload,
      updatedAt: new Date().toISOString(),
    };
    this.dailyRecords.set(key, record);
    return record;
  }

  async listDailyRecordsBetween(startDate, endDate) {
    const start = formatDateKey(new Date(startDate));
    const end = formatDateKey(new Date(endDate));
    return [...this.dailyRecords.values()]
      .filter((record) => record.date >= start && record.date <= end)
      .sort((left, right) => left.date.localeCompare(right.date));
  }
}

module.exports = { MemoryStore, defaultTasks };
