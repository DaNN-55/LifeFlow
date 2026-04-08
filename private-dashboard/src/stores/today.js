import { defineStore } from "pinia";

import { TASK_COLOR_PALETTES, getRandomTaskColor } from "../app/task-constants";
import {
  createTask,
  deleteTask,
  saveAccountPreferences,
  saveDailyRecord,
  updateTask,
} from "../services/today-api";
import {
  loadCachedTodayNoteDrafts,
  saveCachedTodayNoteDrafts,
} from "../services/dashboard-cache";
import {
  applyDashboardMutation,
  hasDashboardSnapshotData,
  loadDashboardSnapshot,
  syncDashboardSnapshot,
} from "../services/sync-service";
import { formatDateKey, formatDisplayDate, formatDateTime, getTodayDateString, parseLocalDate } from "../utils/date";
import { getUserFacingErrorMessage } from "../utils/error-message";
import { getTaskIcon as resolveTaskIcon } from "../utils/task-icons";
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

function buildRecordPayloadFromTasks(tasks = [], record = {}) {
  return {
    tasks: Object.fromEntries(
      tasks.map((task) => {
        const taskState = record?.payload?.tasks?.[task.id] || createEmptyTaskState();
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
    newTaskIcon: "",
    renameDialogTaskId: "",
    renameDraftName: "",
    renameDraftTags: "",
    renameDraftIcon: "",
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
    iconByTaskId() {
      const sessionStore = useSessionStore();
      return sessionStore.user?.preferences?.tasks?.iconByTaskId || {};
    },
  },
  actions: {
    applySnapshot(snapshot = {}) {
      const normalizedTasks = Array.isArray(snapshot?.tasks)
        ? snapshot.tasks.map(normalizeTask).sort((left, right) => left.order - right.order)
        : [];
      this.tasks = normalizedTasks;
      this.record = normalizeRecord(snapshot?.dailyRecords?.[this.selectedDate], normalizedTasks, this.selectedDate);
      this.restoreNoteDrafts();
      this.ready = true;
    },
    persistLocalCache(mutation = {}) {
      const sessionStore = useSessionStore();
      if (!sessionStore.user?.id) {
        return;
      }
      applyDashboardMutation(sessionStore.user.id, {
        tasks: this.tasks,
        dailyRecord: this.record,
        ...mutation,
      });
    },
    restoreNoteDrafts() {
      const sessionStore = useSessionStore();
      if (!sessionStore.user?.id) {
        this.noteDrafts = {};
        return;
      }

      const savedDrafts = loadCachedTodayNoteDrafts(sessionStore.user.id, this.selectedDate);
      const activeTaskIds = new Set(this.tasks.map((task) => String(task.id || "")));

      this.noteDrafts = Object.fromEntries(
        Object.entries(savedDrafts).filter(([taskId]) => activeTaskIds.has(String(taskId || ""))),
      );
    },
    persistNoteDrafts() {
      const sessionStore = useSessionStore();
      if (!sessionStore.user?.id) {
        return;
      }
      saveCachedTodayNoteDrafts(sessionStore.user.id, this.selectedDate, this.noteDrafts);
    },
    handleActionError(error, fallbackMessage) {
      this.error = getUserFacingErrorMessage(error, fallbackMessage);
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
        const cachedSnapshot = loadDashboardSnapshot(sessionStore.user.id);
        const hasCachedData = hasDashboardSnapshotData(cachedSnapshot);

        if (hasCachedData) {
          this.applySnapshot(cachedSnapshot);
          this.setSaveState("数据已从本地缓存载入", "success");
        }

        const remoteSnapshot = await syncDashboardSnapshot(sessionStore.user.id);
        this.applySnapshot(remoteSnapshot);
        this.setSaveState(hasCachedData ? "增量同步已完成" : "数据已从云端载入", "success");
      } catch (error) {
        if (this.ready) {
          this.error = "";
          this.setSaveState("当前离线，已显示最近一次同步内容", "default");
        } else {
          this.handleActionError(error, "Today 模块加载失败");
          this.ready = false;
        }
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
      const nextValue = String(value || "");
      const nextDrafts = {
        ...this.noteDrafts,
      };

      if (nextValue) {
        nextDrafts[taskId] = nextValue;
      } else {
        delete nextDrafts[taskId];
      }

      this.noteDrafts = {
        ...nextDrafts,
      };
      this.persistNoteDrafts();
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
      return buildRecordPayloadFromTasks(this.tasks, this.record);
    },
    getRecordForDate(date) {
      const targetDate = /^\d{4}-\d{2}-\d{2}$/.test(String(date || "")) ? String(date) : this.selectedDate;
      if (targetDate === this.selectedDate) {
        return normalizeRecord(this.record, this.tasks, targetDate);
      }

      const sessionStore = useSessionStore();
      const snapshot = loadDashboardSnapshot(sessionStore.user?.id);
      return normalizeRecord(snapshot?.dailyRecords?.[targetDate], this.tasks, targetDate);
    },
    async persistRecord(successMessage, date = this.selectedDate, mutator = null) {
      const targetDate = /^\d{4}-\d{2}-\d{2}$/.test(String(date || "")) ? String(date) : this.selectedDate;
      const nextRecord = this.getRecordForDate(targetDate);
      if (typeof mutator === "function") {
        mutator(nextRecord);
      }

      if (targetDate === this.selectedDate) {
        this.record = normalizeRecord(nextRecord, this.tasks, targetDate);
      }
      this.persistLocalCache({
        dailyRecord: {
          ...nextRecord,
          payload: buildRecordPayloadFromTasks(this.tasks, nextRecord),
        },
      });

      try {
        this.setSaveState("正在同步到云端...", "progress");
        const response = await saveDailyRecord(targetDate, buildRecordPayloadFromTasks(this.tasks, nextRecord));
        const persistedRecord = normalizeRecord(response?.record, this.tasks, targetDate);
        if (targetDate === this.selectedDate) {
          this.record = persistedRecord;
        }
        this.persistLocalCache({
          dailyRecord: persistedRecord,
        });
        this.setSaveState(successMessage, "success");
        return persistedRecord;
      } catch (error) {
        this.handleActionError(error, "今日记录同步失败");
        return null;
      }
    },
    async persistTask(taskId, payload, successMessage) {
      try {
        this.persistLocalCache();
        this.setSaveState("正在同步到云端...", "progress");
        const response = await updateTask(taskId, payload);
        const normalized = normalizeTask(response?.task || payload);
        this.tasks = this.tasks
          .map((task) => (task.id === taskId ? { ...task, ...normalized } : task))
          .sort((left, right) => left.order - right.order);
        this.persistLocalCache();
        this.setSaveState(successMessage, "success");
        return true;
      } catch (error) {
        this.handleActionError(error, "任务更新失败");
        return false;
      }
    },
    async persistTaskPreferences(taskId, { tags, icon } = {}) {
      const sessionStore = useSessionStore();
      if (!sessionStore.user) {
        return false;
      }

      const nextTagsByTaskId = {
        ...(sessionStore.user.preferences?.tasks?.tagsByTaskId || {}),
      };
      const nextIconByTaskId = {
        ...(sessionStore.user.preferences?.tasks?.iconByTaskId || {}),
      };

      if (Array.isArray(tags)) {
        if (tags.length) {
          nextTagsByTaskId[taskId] = tags;
        } else {
          delete nextTagsByTaskId[taskId];
        }
      }

      if (typeof icon === "string") {
        if (icon) {
          nextIconByTaskId[taskId] = icon;
        } else {
          delete nextIconByTaskId[taskId];
        }
      }

      const nextPreferences = {
        ...(sessionStore.user.preferences || {}),
        tasks: {
          ...(sessionStore.user.preferences?.tasks || {}),
          tagsByTaskId: nextTagsByTaskId,
          iconByTaskId: nextIconByTaskId,
        },
      };

      try {
        const response = await saveAccountPreferences(nextPreferences);
        sessionStore.setPreferences(response?.preferences || nextPreferences);
        return true;
      } catch (error) {
        this.handleActionError(error, "任务偏好同步失败");
        return false;
      }
    },
    async toggleTaskCompletion(taskId) {
      const task = this.tasks.find((item) => item.id === taskId);
      if (!task) {
        return;
      }
      await this.persistRecord(
        `已保存 ${task.name} 的完成状态`,
        this.selectedDate,
        (record) => {
          const taskState = record.payload.tasks[taskId] || createEmptyTaskState();
          taskState.completed = !taskState.completed;
          record.payload.tasks[taskId] = taskState;
        },
      );
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
      const draftText = String(this.noteDrafts[taskId] || "");
      const draft = draftText.trim();
      if (!task || !draft) {
        return;
      }

      const nextDrafts = {
        ...this.noteDrafts,
      };
      delete nextDrafts[taskId];
      this.noteDrafts = nextDrafts;
      this.persistNoteDrafts();

      const persisted = await this.persistRecord(
        `已追加 ${task.name} 的备注`,
        this.selectedDate,
        (record) => {
          const taskState = record.payload.tasks[taskId] || createEmptyTaskState();
          taskState.notes = [
            ...(Array.isArray(taskState.notes) ? taskState.notes : []),
            {
              id: `note-${Date.now()}`,
              text: draft,
              createdAt: buildNoteCreatedAt(this.selectedDate),
            },
          ];
          record.payload.tasks[taskId] = taskState;
        },
      );

      if (!persisted) {
        this.noteDrafts = {
          ...this.noteDrafts,
          [taskId]: draftText,
        };
        this.persistNoteDrafts();
      }
    },
    async deleteTaskNote(taskId, noteId) {
      const task = this.tasks.find((item) => item.id === taskId);
      if (!task) {
        return;
      }
      await this.persistRecord(
        `已删除 ${task.name} 的备注`,
        this.selectedDate,
        (record) => {
          const taskState = record.payload.tasks[taskId] || createEmptyTaskState();
          taskState.notes = (taskState.notes || []).filter((note) => note.id !== noteId);
          record.payload.tasks[taskId] = taskState;
        },
      );
    },
    async appendTaskNoteForDate(taskId, text, date = this.selectedDate) {
      const task = this.tasks.find((item) => item.id === taskId);
      const draft = String(text || "").trim();
      if (!task || !draft) {
        return false;
      }

      const persisted = await this.persistRecord(
        `已追加 ${task.name} 的备注`,
        date,
        (record) => {
          const taskState = record.payload.tasks[taskId] || createEmptyTaskState();
          taskState.notes = [
            ...(Array.isArray(taskState.notes) ? taskState.notes : []),
            {
              id: `note-${Date.now()}`,
              text: draft,
              createdAt: buildNoteCreatedAt(date),
            },
          ];
          record.payload.tasks[taskId] = taskState;
        },
      );

      return Boolean(persisted);
    },
    async createTask(name, tagsInput, color, icon = "") {
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
        await this.persistTaskPreferences(createdTask.id, { tags, icon });
        this.activePaletteTaskId = "";
        this.newTaskColor = "";
        this.newTaskIcon = "";
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
      this.renameDraftIcon = this.iconByTaskId[taskId] || "";
      this.activeTaskMenuId = "";
    },
    closeRenameDialog() {
      this.renameDialogTaskId = "";
      this.renameDraftName = "";
      this.renameDraftTags = "";
      this.renameDraftIcon = "";
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
      const nextIcon = String(this.renameDraftIcon || "");
      const currentIcon = this.iconByTaskId[task.id] || "";
      const nextTaskName = nextName || task.name;

      if (nextName && nextName !== task.name) {
        const updated = await this.persistTask(task.id, { name: nextName }, `已更新任务：${nextName}`);
        if (!updated) {
          return;
        }
      }
      if (JSON.stringify(nextTags) !== JSON.stringify(currentTags) || nextIcon !== currentIcon) {
        const updatedPreferences = await this.persistTaskPreferences(task.id, { tags: nextTags, icon: nextIcon });
        if (!updatedPreferences) {
          return;
        }
        this.setSaveState(`已更新 ${nextTaskName} 的任务设置`, "success");
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
        const nextIconByTaskId = { ...(sessionStore.user?.preferences?.tasks?.iconByTaskId || {}) };
        delete nextTagsByTaskId[task.id];
        delete nextIconByTaskId[task.id];
        const nextPreferences = {
          ...(sessionStore.user?.preferences || {}),
          tasks: {
            ...(sessionStore.user?.preferences?.tasks || {}),
            tagsByTaskId: nextTagsByTaskId,
            iconByTaskId: nextIconByTaskId,
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
    getTaskIcon(taskId, taskName = "") {
      return resolveTaskIcon(taskName, this.iconByTaskId[taskId] || "");
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
