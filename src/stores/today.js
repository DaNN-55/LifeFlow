import { defineStore } from "pinia";

import { TASK_COLOR_PALETTES, getRandomTaskColor } from "../app/task-constants";
import { alphaAnalytics, alphaAnalyticsMode } from "../services/alpha-analytics.js";
import { stateContinuity, views } from "../services/state-continuity";
import { formatDateKey, formatDisplayDate, formatDateTime, getTodayDateString, parseLocalDate } from "../utils/date";
import { getUserFacingErrorMessage } from "../utils/error-message";
import { getTaskIcon as resolveTaskIcon } from "../utils/task-icons";
import { useSessionStore } from "./session";

let observedScope = null;
let stopObserving = null;

function normalizeTask(task = {}, index = 0) {
  return {
    id: String(task.id || ""),
    name: String(task.name || "未命名任务"),
    color: String(task.color || getRandomTaskColor()),
    order: Number(task.display_order || index + 1),
    archived: Boolean(task.archived),
    archivedAt: task.archived_at || "",
    lifecycleEvents: Array.isArray(task.lifecycle_events || task.lifecycleEvents)
      ? (task.lifecycle_events || task.lifecycleEvents).map(normalizeLifecycleEvent)
      : [],
    tags: Array.isArray(task.tags) ? task.tags : [],
    icon: String(task.icon || ""),
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

function normalizeLifecycleEvent(event = {}) {
  return {
    taskId: String(event.taskId || ""),
    type: event.type === "restore" ? "restore" : "archive",
    changedAt: String(event.changedAt || ""),
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
    demoOnboarding: null,
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
    deleteNoteDialogTaskId: "",
    deleteNoteDialogNoteId: "",
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
      return sessionStore.preferences?.tasks?.tagsByTaskId || {};
    },
    iconByTaskId() {
      const sessionStore = useSessionStore();
      return sessionStore.preferences?.tasks?.iconByTaskId || {};
    },
  },
  actions: {
    getContinuityScope() {
      const sessionStore = useSessionStore();
      if (sessionStore.previewMode) {
        return stateContinuity.open({ mode: "demo" });
      }
      if (!sessionStore.user?.id) {
        return null;
      }
      return stateContinuity.open({ id: sessionStore.user.id });
    },
    getTodayProjection() {
      const scope = this.getContinuityScope();
      return scope ? scope.view(views.today({ date: this.selectedDate })) : null;
    },
    observeContinuity(scope) {
      if (!scope || observedScope === scope) return;
      stopObserving?.();
      observedScope = scope;
      stopObserving = scope.observe(() => this.applyProjection(scope.view(views.today({ date: this.selectedDate }))));
    },
    applyProjection(projection) {
      const data = projection?.data || {};
      const normalizedTasks = Array.isArray(data.tasks)
        ? data.tasks.map(normalizeTask).sort((left, right) => left.order - right.order)
        : [];
      this.tasks = normalizedTasks;
      this.record = normalizeRecord(data.record, normalizedTasks, this.selectedDate);
      const activeTaskIds = new Set(normalizedTasks.map((task) => task.id));
      this.noteDrafts = Object.fromEntries(
        Object.entries(data.drafts || {}).filter(([taskId]) => activeTaskIds.has(String(taskId || ""))),
      );
      this.demoOnboarding = data.onboarding && typeof data.onboarding === "object"
        ? {
            collapsed: Boolean(data.onboarding.collapsed),
            executionRecorded: Boolean(data.onboarding.executionRecorded),
            syntheticNewsFavorited: Boolean(data.onboarding.syntheticNewsFavorited),
            periodReviewOpened: Boolean(data.onboarding.periodReviewOpened),
          }
        : null;
      this.ready = true;
    },
    restoreNoteDrafts() {
      const projection = this.getTodayProjection();
      if (projection) {
        this.applyProjection(projection);
      }
    },
    persistNoteDrafts() {
      const scope = this.getContinuityScope();
      if (!scope) {
        return;
      }
      scope.change((writes) => writes.today.saveDrafts(this.selectedDate, this.noteDrafts));
    },
    handleActionError(error, fallbackMessage) {
      this.error = getUserFacingErrorMessage(error, fallbackMessage);
      this.setSaveState(this.error, "error");
    },
    async bootstrap() {
      const scope = this.getContinuityScope();
      if (!scope) {
        this.ready = false;
        return;
      }

      if (this.loading) {
        return;
      }

      this.loading = true;
      this.error = "";
      this.observeContinuity(scope);

      try {
        const initialProjection = this.getTodayProjection();
        const hasCachedData = initialProjection?.freshness === "cached";
        if (hasCachedData || initialProjection?.freshness === "demo") {
          this.applyProjection(initialProjection);
          this.setSaveState("数据已从本地缓存载入", "success");
        }
        await scope.control.sync();
        this.applyProjection(this.getTodayProjection());
        this.setSaveState(initialProjection?.freshness === "demo"
          ? "Demo 数据仅保存在独立的本地空间"
          : (hasCachedData ? "增量同步已完成" : "数据已从云端载入"), "success");
      } catch (error) {
        const projection = this.getTodayProjection();
        if (projection?.freshness === "cached") {
          this.applyProjection(projection);
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

      this.noteDrafts = nextDrafts;
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
    async setDemoOnboardingCollapsed(collapsed) {
      const sessionStore = useSessionStore();
      if (!sessionStore.previewMode) return;
      const scope = this.getContinuityScope();
      await scope.change((writes) => writes.demo.setOnboardingCollapsed(collapsed));
      this.applyProjection(this.getTodayProjection());
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

      const scope = this.getContinuityScope();
      const projection = scope?.view(views.today({ date: targetDate }));
      return normalizeRecord(projection?.data.record, this.tasks, targetDate);
    },
    async persistRecord(successMessage, date = this.selectedDate, mutator = null) {
      const targetDate = /^\d{4}-\d{2}-\d{2}$/.test(String(date || "")) ? String(date) : this.selectedDate;
      const nextRecord = this.getRecordForDate(targetDate);
      if (typeof mutator === "function") {
        mutator(nextRecord);
      }

      const scope = this.getContinuityScope();
      if (!scope) {
        return null;
      }
      const payload = buildRecordPayloadFromTasks(this.tasks, nextRecord);
      const pending = scope.change((writes) => writes.today.saveRecord(targetDate, payload));
      this.applyProjection(this.getTodayProjection());

      try {
        this.setSaveState("正在同步到云端...", "progress");
        await pending;
        this.applyProjection(this.getTodayProjection());
        this.setSaveState(successMessage, "success");
        return this.getRecordForDate(targetDate);
      } catch (error) {
        this.applyProjection(this.getTodayProjection());
        this.handleActionError(error, "今日记录同步失败");
        return null;
      }
    },
    async persistTask(taskId, payload, successMessage) {
      const scope = this.getContinuityScope();
      if (!scope) return false;
      const pending = scope.change((writes) => writes.today.updateTask(taskId, payload));
      this.applyProjection(this.getTodayProjection());
      try {
        this.setSaveState("正在同步到云端...", "progress");
        await pending;
        this.applyProjection(this.getTodayProjection());
        this.setSaveState(successMessage, "success");
        return true;
      } catch (error) {
        this.applyProjection(this.getTodayProjection());
        this.handleActionError(error, "任务更新失败");
        return false;
      }
    },
    async restoreTask(taskId) {
      const task = this.tasks.find((item) => String(item.id) === String(taskId));
      if (!task) return false;
      const changedAt = new Date().toISOString();
      const lifecycleEvents = [...task.lifecycleEvents, normalizeLifecycleEvent({ taskId: task.id, type: "restore", changedAt })];
      const restored = await this.persistTask(
        task.id,
        { archived: false, lifecycleEvents },
        `已恢复任务：${task.name}`,
      );
      return restored;
    },
    async persistTaskPreferences(taskId, { tags, icon } = {}) {
      const sessionStore = useSessionStore();
      if (sessionStore.previewMode) {
        const scope = this.getContinuityScope();
        await scope.change((writes) => writes.today.updateTask(taskId, {
          ...(Array.isArray(tags) ? { tags } : {}),
          ...(typeof icon === "string" ? { icon } : {}),
        }));
        this.applyProjection(this.getTodayProjection());
        return true;
      }
      if (!sessionStore.user) {
        return false;
      }

      try {
        const scope = this.getContinuityScope();
        const response = await scope.change((writes) => writes.today.updateTaskPreferences(taskId, { tags, icon }));
        sessionStore.setPreferences(response?.preferences || scope.view(views.information()).data.preferences);
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
      const wasCompleted = Boolean(this.record.payload.tasks[taskId]?.completed);
      const persisted = await this.persistRecord(
        `已保存 ${task.name} 的完成状态`,
        this.selectedDate,
        (record) => {
          const taskState = record.payload.tasks[taskId] || createEmptyTaskState();
          taskState.completed = !taskState.completed;
          record.payload.tasks[taskId] = taskState;
        },
      );
      if (persisted && !wasCompleted) {
        alphaAnalytics.record("first_task_completed", { mode: alphaAnalyticsMode(useSessionStore()) });
      }
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
      } else {
        alphaAnalytics.record("first_execution_note_added", { mode: alphaAnalyticsMode(useSessionStore()) });
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

      if (persisted) {
        alphaAnalytics.record("first_execution_note_added", { mode: alphaAnalyticsMode(useSessionStore()) });
      }
      return Boolean(persisted);
    },
    async createTask(name, tagsInput, color, icon = "") {
      const normalizedName = String(name || "").trim();
      if (!normalizedName) {
        return;
      }

      const sessionStore = useSessionStore();
      if (sessionStore.previewMode) {
        const scope = this.getContinuityScope();
        await scope.change((writes) => writes.today.createTask({
          name: normalizedName,
          tags: normalizeTaskTags(tagsInput),
          color: color || getRandomTaskColor(),
          icon,
        }));
        this.applyProjection(this.getTodayProjection());
        this.newTaskColor = "";
        this.newTaskIcon = "";
        this.setSaveState(`已创建任务：${normalizedName} · Demo 本地保存`, "success");
        return;
      }

      try {
        this.setSaveState("正在同步到云端...", "progress");
        const scope = this.getContinuityScope();
        const response = await scope.change((writes) => writes.today.createTask({
          name: normalizedName,
          color: color || getRandomTaskColor(),
          displayOrder: this.tasks.length + 1,
          archived: false,
        }));
        this.applyProjection(this.getTodayProjection());
        const createdTask = this.tasks.find((task) => task.id === String(response?.task?.id || ""));
        if (!createdTask) {
          throw new Error("创建任务后未收到任务数据");
        }
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
      const changedAt = new Date().toISOString();
      task.archived = true;
      task.archivedAt = changedAt;
      const lifecycleEvents = [...task.lifecycleEvents, normalizeLifecycleEvent({ taskId: task.id, type: "archive", changedAt })];
      const archived = await this.persistTask(
        task.id,
        { archived: true, archivedAt: task.archivedAt, lifecycleEvents },
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
      const taskId = String(this.deleteDialogTaskId || "");
      if (!taskId) {
        this.closeDeleteDialog();
        return;
      }
      const task = this.tasks.find((item) => item.id === taskId) || null;
      const taskName = task?.name || "该任务";
      const sessionStore = useSessionStore();
      if (sessionStore.previewMode) {
        await this.getContinuityScope().change((writes) => writes.today.deleteTask(taskId));
        this.applyProjection(this.getTodayProjection());
        this.setSaveState(`已删除任务：${taskName} · Demo 本地保存`, "success");
        this.closeDeleteDialog();
        return;
      }
      try {
        this.setSaveState("正在同步到云端...", "progress");
        const scope = this.getContinuityScope();
        const deleted = scope.change((writes) => writes.today.deleteTask(taskId));
        this.applyProjection(this.getTodayProjection());
        await deleted;
        this.applyProjection(this.getTodayProjection());
        const response = await scope.change((writes) => writes.today.updateTaskPreferences(taskId, { tags: [], icon: "" }));
        sessionStore.setPreferences(response?.preferences || scope.view(views.information()).data.preferences);
        this.setSaveState(`已删除任务：${taskName}`, "success");
        this.closeDeleteDialog();
      } catch (error) {
        this.applyProjection(this.getTodayProjection());
        this.handleActionError(error, "删除任务失败");
      }
    },
    openDeleteNoteDialog(taskId, noteId) {
      this.deleteNoteDialogTaskId = taskId;
      this.deleteNoteDialogNoteId = noteId;
      this.activeTaskMenuId = "";
    },
    closeDeleteNoteDialog() {
      this.deleteNoteDialogTaskId = "";
      this.deleteNoteDialogNoteId = "";
    },
    async confirmDeleteNote() {
      const taskId = this.deleteNoteDialogTaskId;
      const noteId = this.deleteNoteDialogNoteId;
      if (!taskId || !noteId) {
        this.closeDeleteNoteDialog();
        return;
      }
      await this.deleteTaskNote(taskId, noteId);
      this.closeDeleteNoteDialog();
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

      try {
        this.setSaveState("正在同步排序...", "progress");
        const scope = this.getContinuityScope();
        const writes = changedTasks.map((task) => scope.change((operations) =>
          operations.today.updateTask(task.id, { displayOrder: task.order }),
        ));
        this.applyProjection(this.getTodayProjection());
        await Promise.all(writes);
        this.applyProjection(this.getTodayProjection());
        this.setSaveState(useSessionStore().previewMode ? "任务顺序已更新 · Demo 本地保存" : "任务顺序已更新", "success");
      } catch (error) {
        this.applyProjection(this.getTodayProjection());
        this.handleActionError(error, "任务排序同步失败");
      }
    },
    getTaskState(taskId) {
      return this.ensureTaskRecord(taskId);
    },
    getTaskTags(taskId) {
      const task = this.tasks.find((item) => item.id === taskId);
      return useSessionStore().previewMode ? (task?.tags || []) : (this.tagsByTaskId[taskId] || []);
    },
    getTaskIcon(taskId, taskName = "") {
      const task = this.tasks.find((item) => item.id === taskId);
      return resolveTaskIcon(taskName, useSessionStore().previewMode ? (task?.icon || "") : (this.iconByTaskId[taskId] || ""));
    },
    getTaskForDialog(taskId) {
      return this.tasks.find((item) => item.id === taskId) || null;
    },
    getTaskNoteForDialog(taskId, noteId) {
      if (!taskId || !noteId) {
        return null;
      }
      const taskState = this.record?.payload?.tasks?.[taskId];
      return taskState?.notes?.find((note) => note.id === noteId) || null;
    },
    formatDateTime,
    formatDateKey,
    formatDisplayDate,
    parseLocalDate,
    todayDate: getTodayDateString,
    colorPalettes: TASK_COLOR_PALETTES,
  },
});
