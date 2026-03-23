import { defineStore } from "pinia";

import { TASK_COLOR_PALETTES, getRandomTaskColor } from "../app/task-constants";
import {
  loadCachedDailyRecord,
  loadCachedTasks,
  saveCachedDailyRecord,
  saveCachedTasks,
} from "../services/dashboard-cache";
import {
  createTask,
  deleteTask,
  fetchDailyRecord,
  listTasks,
  saveAccountPreferences,
  saveDailyRecord,
  updateTask,
} from "../services/today-api";
import { formatDateKey, formatDisplayDate, formatDateTime, getTodayDateString, parseLocalDate } from "../utils/date";
import { useSessionStore } from "./session";

function normalizeTask(task = {}, index = 0) {
  return {
    id: String(task.id || ""),
    name: String(task.name || "未命名任务"),
    color: String(task.color || getRandomTaskColor()),
    order: Number(task.display_order || index + 1),
    archived: Boolean(task.archived),
    archivedAt: task.archived_at || "",
  };
}

function normalizeNote(note = {}) {
  return {
    id: String(note.id || `note-${Date.now()}`),
    text: String(note.text || ""),
    createdAt: String(note.createdAt || note.created_at || new Date().toISOString()),
  };
}

function normalizeTaskState(taskState = {}) {
  return {
    completed: Boolean(taskState.completed),
    notes: Array.isArray(taskState.notes) ? taskState.notes.map(normalizeNote) : [],
  };
}

function createEmptyTaskState() {
  return {
    completed: false,
    notes: [],
  };
}

function normalizeRecord(record = {}, tasks = [], selectedDate = getTodayDateString()) {
  const payloadTasks = record?.payload?.tasks && typeof record.payload.tasks === "object"
    ? record.payload.tasks
    : {};
  const normalizedTasks = Object.fromEntries(
    tasks.map((task) => [task.id, normalizeTaskState(payloadTasks[task.id] || createEmptyTaskState())]),
  );

  return {
    date: String(record?.date || selectedDate),
    updatedAt: String(record?.updatedAt || ""),
    payload: {
      tasks: normalizedTasks,
    },
  };
}

function normalizeTaskTags(tags) {
  return [
    ...new Set(
      String(tags || "")
        .split(/[,，\n]/)
        .map((tag) => tag.trim().replace(/^#+/, ""))
        .filter(Boolean)
        .slice(0, 6)
        .map((tag) => tag.slice(0, 24)),
    ),
  ];
}

function buildNoteCreatedAt(selectedDate) {
  const now = new Date();
  const date = parseLocalDate(selectedDate);
  date.setHours(now.getHours(), now.getMinutes(), 0, 0);
  return date.toISOString();
}

export const useTodayStore = defineStore("today", {
  state: () => ({
    selectedDate: getTodayDateString(),
    tasks: [],
    record: {
      date: getTodayDateString(),
      updatedAt: "",
      payload: { tasks: {} },
    },
    loading: false,
    error: "",
    saveStatus: "数据将自动保存到云端",
    saveTone: "default",
    ready: false,
    noteDrafts: {},
    activeTaskMenuId: null,
    activePaletteTaskId: null,
    newTaskColor: "",
    renameDialogTaskId: "",
    renameDraftName: "",
    renameDraftTags: "",
    archiveDialogTaskId: "",
    deleteDialogTaskId: "",
  }),
  getters: {
    activeTasks(state) {
      return state.tasks
        .filter((task) => !task.archived)
        .sort((left, right) => {
          const leftCompleted = state.record.payload.tasks[left.id]?.completed ? 1 : 0;
          const rightCompleted = state.record.payload.tasks[right.id]?.completed ? 1 : 0;
          if (leftCompleted !== rightCompleted) {
            return leftCompleted - rightCompleted;
          }
          return left.order - right.order;
        });
    },
    completedCount(state) {
      return state.tasks.filter((task) => !task.archived).filter((task) => state.record.payload.tasks[task.id]?.completed).length;
    },
    activeTaskCount(state) {
      return state.tasks.filter((task) => !task.archived).length;
    },
    selectedDateLabel(state) {
      return formatDisplayDate(parseLocalDate(state.selectedDate));
    },
    tagsByTaskId() {
      const sessionStore = useSessionStore();
      return sessionStore.user?.preferences?.tasks?.tagsByTaskId || {};
    },
  },
  actions: {
    persistLocalCache() {
      const sessionStore = useSessionStore();
      if (!sessionStore.user?.id) {
        return;
      }
      saveCachedTasks(sessionStore.user.id, this.tasks);
      saveCachedDailyRecord(sessionStore.user.id, this.record);
    },
    handleActionError(error, fallbackMessage) {
      this.error = error?.message || fallbackMessage;
      this.setSaveState(this.error, "error");
    },
    async bootstrap() {
      const sessionStore = useSessionStore();
      if (!sessionStore.user?.id) {
        this.ready = false;
        return;
      }

      if (this.loading) {
        return;
      }

      this.loading = true;
      this.error = "";

      try {
        const cachedTasks = loadCachedTasks(sessionStore.user.id);
        const cachedRecord = loadCachedDailyRecord(sessionStore.user.id, this.selectedDate);

        if (cachedTasks.length) {
          this.tasks = cachedTasks.map(normalizeTask);
        }
        if (cachedRecord) {
          this.record = normalizeRecord(cachedRecord, this.tasks, this.selectedDate);
        }

        if (cachedTasks.length && cachedRecord) {
          this.ready = true;
          this.saveStatus = "数据已从本地缓存载入";
          this.saveTone = "success";
          return;
        }

        const [tasksPayload, recordPayload] = await Promise.all([
          cachedTasks.length ? Promise.resolve({ tasks: cachedTasks }) : listTasks(),
          cachedRecord ? Promise.resolve({ record: cachedRecord }) : fetchDailyRecord(this.selectedDate),
        ]);

        this.tasks = (tasksPayload?.tasks || []).map(normalizeTask);
        this.record = normalizeRecord(recordPayload?.record, this.tasks, this.selectedDate);
        this.persistLocalCache();
        this.ready = true;
        this.saveStatus = cachedTasks.length || cachedRecord ? "本地缓存已补齐" : "数据已从云端载入";
        this.saveTone = "success";
      } catch (error) {
        this.handleActionError(error, "Today 模块加载失败");
        this.ready = false;
      } finally {
        this.loading = false;
      }
    },
    async selectDate(date) {
      const nextDate = /^\d{4}-\d{2}-\d{2}$/.test(String(date || "")) ? String(date) : getTodayDateString();
      if (nextDate === this.selectedDate && this.ready) {
        return;
      }
      this.selectedDate = nextDate;
      await this.bootstrap();
    },
    ensureTaskRecord(taskId) {
      if (!this.record.payload.tasks[taskId]) {
        this.record.payload.tasks[taskId] = createEmptyTaskState();
      }
      return this.record.payload.tasks[taskId];
    },
    setNoteDraft(taskId, value) {
      this.noteDrafts = {
        ...this.noteDrafts,
        [taskId]: String(value || ""),
      };
    },
    toggleTaskMenu(taskId) {
      this.activeTaskMenuId = this.activeTaskMenuId === taskId ? "" : taskId;
    },
    toggleTaskPalette(taskId) {
      this.activePaletteTaskId = this.activePaletteTaskId === taskId ? "" : taskId;
    },
    closeTransientUi() {
      this.activeTaskMenuId = "";
      this.activePaletteTaskId = "";
    },
    setSaveState(message, tone = "default") {
      this.saveStatus = message;
      this.saveTone = tone;
    },
    buildRecordPayload() {
      return {
        tasks: Object.fromEntries(
          this.tasks.map((task) => {
            const taskState = this.ensureTaskRecord(task.id);
            return [
              task.id,
              {
                completed: Boolean(taskState.completed),
                notes: Array.isArray(taskState.notes) ? taskState.notes : [],
              },
            ];
          }),
        ),
      };
    },
    async persistRecord(successMessage) {
      try {
        this.setSaveState("正在同步到云端...", "progress");
        const response = await saveDailyRecord(this.selectedDate, this.buildRecordPayload());
        this.record = normalizeRecord(response?.record, this.tasks, this.selectedDate);
        this.persistLocalCache();
        this.setSaveState(successMessage, "success");
      } catch (error) {
        this.handleActionError(error, "今日记录同步失败");
      }
    },
    async persistTask(taskId, payload, successMessage) {
      try {
        this.setSaveState("正在同步到云端...", "progress");
        const response = await updateTask(taskId, payload);
        const normalized = normalizeTask(response?.task || payload);
        this.tasks = this.tasks
          .map((task) => (task.id === taskId ? { ...task, ...normalized } : task))
          .sort((left, right) => left.order - right.order);
        this.persistLocalCache();
        this.setSaveState(successMessage, "success");
      } catch (error) {
        this.handleActionError(error, "任务更新失败");
      }
    },
    async persistTaskTags(taskId, tags) {
      const sessionStore = useSessionStore();
      if (!sessionStore.user) {
        return;
      }

      const nextPreferences = {
        ...(sessionStore.user.preferences || {}),
        tasks: {
          ...(sessionStore.user.preferences?.tasks || {}),
          tagsByTaskId: {
            ...(sessionStore.user.preferences?.tasks?.tagsByTaskId || {}),
            [taskId]: tags,
          },
        },
      };

      if (!tags.length) {
        delete nextPreferences.tasks.tagsByTaskId[taskId];
      }

      try {
        const response = await saveAccountPreferences(nextPreferences);
        sessionStore.setPreferences(response?.preferences || nextPreferences);
      } catch (error) {
        this.handleActionError(error, "任务标签同步失败");
      }
    },
    async toggleTaskCompletion(taskId) {
      const task = this.tasks.find((item) => item.id === taskId);
      if (!task) {
        return;
      }
      const taskState = this.ensureTaskRecord(taskId);
      taskState.completed = !taskState.completed;
      await this.persistRecord(`已保存 ${task.name} 的完成状态`);
    },
    async setTaskColor(taskId, color) {
      const task = this.tasks.find((item) => item.id === taskId);
      if (!task) {
        return;
      }
      task.color = color;
      this.activePaletteTaskId = "";
      await this.persistTask(taskId, { color }, `已更新 ${task.name} 的颜色`);
    },
    async submitTaskNote(taskId) {
      const task = this.tasks.find((item) => item.id === taskId);
      const draft = String(this.noteDrafts[taskId] || "").trim();
      if (!task || !draft) {
        return;
      }
      const taskState = this.ensureTaskRecord(taskId);
      taskState.notes.push({
        id: `note-${Date.now()}`,
        text: draft,
        createdAt: buildNoteCreatedAt(this.selectedDate),
      });
      this.noteDrafts = {
        ...this.noteDrafts,
        [taskId]: "",
      };
      await this.persistRecord(`已追加 ${task.name} 的备注`);
    },
    async deleteTaskNote(taskId, noteId) {
      const task = this.tasks.find((item) => item.id === taskId);
      const taskState = this.ensureTaskRecord(taskId);
      if (!task) {
        return;
      }
      taskState.notes = taskState.notes.filter((note) => note.id !== noteId);
      await this.persistRecord(`已删除 ${task.name} 的备注`);
    },
    async createTask(name, tagsInput, color) {
      const normalizedName = String(name || "").trim();
      if (!normalizedName) {
        return;
      }

      try {
        this.setSaveState("正在同步到云端...", "progress");
        const response = await createTask({
          name: normalizedName,
          color: color || getRandomTaskColor(),
          displayOrder: this.tasks.length + 1,
          archived: false,
        });
        const createdTask = normalizeTask(response?.task || {}, this.tasks.length);
        this.tasks = [...this.tasks, createdTask].sort((left, right) => left.order - right.order);
        this.record.payload.tasks[createdTask.id] = createEmptyTaskState();
        this.persistLocalCache();
        const tags = normalizeTaskTags(tagsInput);
        await this.persistTaskTags(createdTask.id, tags);
        this.activePaletteTaskId = "";
        this.newTaskColor = "";
        this.setSaveState(`已创建任务：${createdTask.name}`, "success");
      } catch (error) {
        this.handleActionError(error, "创建任务失败");
      }
    },
    openRenameDialog(taskId) {
      const task = this.tasks.find((item) => item.id === taskId);
      if (!task) {
        return;
      }
      this.renameDialogTaskId = taskId;
      this.renameDraftName = task.name;
      this.renameDraftTags = (this.tagsByTaskId[taskId] || []).join(", ");
      this.activeTaskMenuId = "";
    },
    closeRenameDialog() {
      this.renameDialogTaskId = "";
      this.renameDraftName = "";
      this.renameDraftTags = "";
    },
    async confirmRename() {
      const task = this.tasks.find((item) => item.id === this.renameDialogTaskId);
      if (!task) {
        this.closeRenameDialog();
        return;
      }
      const nextName = String(this.renameDraftName || "").trim();
      const nextTags = normalizeTaskTags(this.renameDraftTags);
      const currentTags = this.tagsByTaskId[task.id] || [];

      if (nextName && nextName !== task.name) {
        task.name = nextName;
        await this.persistTask(task.id, { name: nextName }, `已更新任务：${nextName}`);
      }
      if (JSON.stringify(nextTags) !== JSON.stringify(currentTags)) {
        await this.persistTaskTags(task.id, nextTags);
        this.setSaveState(`已更新 ${nextName || task.name} 的标签`, "success");
      }
      this.closeRenameDialog();
    },
    openArchiveDialog(taskId) {
      this.archiveDialogTaskId = taskId;
      this.activeTaskMenuId = "";
    },
    closeArchiveDialog() {
      this.archiveDialogTaskId = "";
    },
    async confirmArchive() {
      const task = this.tasks.find((item) => item.id === this.archiveDialogTaskId);
      if (!task) {
        this.closeArchiveDialog();
        return;
      }
      task.archived = true;
      task.archivedAt = new Date().toISOString();
      await this.persistTask(
        task.id,
        { archived: true, archivedAt: task.archivedAt },
        `已存档任务：${task.name}`,
      );
      this.closeArchiveDialog();
    },
    openDeleteDialog(taskId) {
      this.deleteDialogTaskId = taskId;
      this.activeTaskMenuId = "";
    },
    closeDeleteDialog() {
      this.deleteDialogTaskId = "";
    },
    async confirmDelete() {
      const task = this.tasks.find((item) => item.id === this.deleteDialogTaskId);
      if (!task) {
        this.closeDeleteDialog();
        return;
      }
      try {
        this.setSaveState("正在同步到云端...", "progress");
        await deleteTask(task.id);
        this.tasks = this.tasks.filter((item) => item.id !== task.id);
        delete this.record.payload.tasks[task.id];
        this.persistLocalCache();
        const sessionStore = useSessionStore();
        const nextTagsByTaskId = { ...(sessionStore.user?.preferences?.tasks?.tagsByTaskId || {}) };
        delete nextTagsByTaskId[task.id];
        const nextPreferences = {
          ...(sessionStore.user?.preferences || {}),
          tasks: {
            ...(sessionStore.user?.preferences?.tasks || {}),
            tagsByTaskId: nextTagsByTaskId,
          },
        };
        const response = await saveAccountPreferences(nextPreferences);
        sessionStore.setPreferences(response?.preferences || nextPreferences);
        this.setSaveState(`已删除任务：${task.name}`, "success");
        this.closeDeleteDialog();
      } catch (error) {
        this.handleActionError(error, "删除任务失败");
      }
    },
    async reorderTasks(orderedTaskIds = []) {
      const orderMap = new Map(orderedTaskIds.map((taskId, index) => [taskId, index + 1]));
      const changedTasks = this.tasks
        .filter((task) => orderMap.has(task.id))
        .map((task) => {
          const nextOrder = orderMap.get(task.id);
          return nextOrder !== task.order ? { ...task, order: nextOrder } : null;
        })
        .filter(Boolean);

      if (!changedTasks.length) {
        return;
      }

      this.tasks = this.tasks
        .map((task) => changedTasks.find((candidate) => candidate.id === task.id) || task)
        .sort((left, right) => left.order - right.order);

      try {
        this.setSaveState("正在同步排序...", "progress");
        await Promise.all(
          changedTasks.map((task) =>
            updateTask(task.id, { displayOrder: task.order }),
          ),
        );
        this.persistLocalCache();
        this.setSaveState("任务顺序已更新", "success");
      } catch (error) {
        this.handleActionError(error, "任务排序同步失败");
      }
    },
    getTaskState(taskId) {
      return this.ensureTaskRecord(taskId);
    },
    getTaskTags(taskId) {
      return this.tagsByTaskId[taskId] || [];
    },
    getTaskForDialog(taskId) {
      return this.tasks.find((item) => item.id === taskId) || null;
    },
    formatDateTime,
    formatDateKey,
    formatDisplayDate,
    parseLocalDate,
    todayDate: getTodayDateString,
    colorPalettes: TASK_COLOR_PALETTES,
  },
});
