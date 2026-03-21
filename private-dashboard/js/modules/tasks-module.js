export function createTasksModule(deps) {
  const {
    state,
    elements,
    TASK_COLOR_PALETTES,
    ensureRecord,
    getActiveTaskTypes,
    formatDateTime,
    escapeHtml,
    escapeAttribute,
    persistStateSilently,
    saveAccountPreferencesRemote,
    renderControls,
    renderWeeklyReview,
    render,
    syncCurrentRecord,
    syncTaskCreate,
    syncTaskUpdate,
    syncTaskDelete,
    syncRecordByDate,
    getRandomPaletteColor,
    permanentlyRemoveTaskFromLocalState,
    getTaskTags,
    setTaskTags,
    clearTaskTags,
    setUndoAction,
    setSaveStatus,
    isTaskArchived,
    migrateTaskRecord,
    formatDisplayDate,
    parseLocalDate,
  } = deps;
  let taskListSortable = null;
  const markdownRenderer =
    typeof window !== "undefined" && typeof window.markdownit === "function"
      ? window.markdownit({
          html: false,
          breaks: true,
          linkify: true,
          typographer: true,
        })
      : null;

  function renderTaskNoteMarkdown(markdown) {
    const source = String(markdown || "").replace(/\r\n/g, "\n").trim();
    if (!source) {
      return "";
    }

    const rendered = markdownRenderer
      ? markdownRenderer.render(source)
      : `<p>${escapeHtml(source).replace(/\n/g, "<br>")}</p>`;

    if (
      typeof window !== "undefined" &&
      window.DOMPurify &&
      typeof window.DOMPurify.sanitize === "function"
    ) {
      return window.DOMPurify.sanitize(rendered, {
        USE_PROFILES: { html: true },
      });
    }

    return rendered;
  }

  function normalizeTaskTagsInput(value) {
    return [
      ...new Set(
        String(value || "")
          .split(/[,，\n]/)
          .map((tag) => tag.trim().replace(/^#+/, ""))
          .filter(Boolean)
          .slice(0, 6)
          .map((tag) => tag.slice(0, 24)),
      ),
    ];
  }

  function getTaskTagsText(tags) {
    return (Array.isArray(tags) ? tags : []).join(", ");
  }

  function getDefaultNoteTimeValue() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }

  function normalizeNoteTimeValue(value) {
    return /^\d{2}:\d{2}$/.test(String(value || "").trim()) ? String(value).trim() : "";
  }

  function getDraftNoteTime(taskId) {
    return normalizeNoteTimeValue(state.noteTimeDrafts?.[taskId]) || getDefaultNoteTimeValue();
  }

  function buildNoteCreatedAt(timeValue) {
    const normalizedTime = normalizeNoteTimeValue(timeValue);
    if (!normalizedTime) {
      return new Date().toISOString();
    }
    const [hours, minutes] = normalizedTime.split(":").map((value) => Number(value));
    const baseDate = parseLocalDate(state.selectedDate) || new Date();
    baseDate.setHours(hours || 0, minutes || 0, 0, 0);
    return baseDate.toISOString();
  }

  function renderTaskTags(tags) {
    if (!Array.isArray(tags) || tags.length === 0) {
      return "";
    }
    return `<div class="task-tag-row">${tags
      .map((tag) => `<span class="task-tag">#${escapeHtml(tag)}</span>`)
      .join("")}</div>`;
  }

  async function syncTaskTagPreferences(fallbackMessage = "") {
    if (!state.auth.user) {
      return true;
    }
    try {
      await saveAccountPreferencesRemote();
      return true;
    } catch (error) {
      console.warn("Failed to sync task tags remotely.", error);
      if (fallbackMessage) {
        setSaveStatus(`${fallbackMessage}，标签同步失败，当前仅保存在本地`);
      }
      return false;
    }
  }

  function renderTaskColorPalette(taskId, selectedColor) {
    return TASK_COLOR_PALETTES.map(
      (palette) => `
        <button
          type="button"
          class="palette-swatch ${palette.value === selectedColor ? "is-active" : ""}"
          style="--swatch-color:${palette.value};"
          title="${palette.label}"
          aria-label="${palette.label}"
          data-action="set-task-color"
          data-task-id="${taskId}"
          data-color="${palette.value}"
        ></button>
      `,
    ).join("");
  }

  function renderNewTaskColorPalette(selectedColor) {
    return TASK_COLOR_PALETTES.map(
      (palette) => `
        <button
          type="button"
          class="palette-swatch ${palette.value === selectedColor ? "is-active" : ""}"
          style="--swatch-color:${palette.value};"
          title="${palette.label}"
          aria-label="${palette.label}"
          data-action="set-new-task-color"
          data-color="${palette.value}"
        ></button>
      `,
    ).join("");
  }

  function renderTaskList() {
    const record = ensureRecord(state.selectedDate);
    const sortedTasks = [...getActiveTaskTypes()].sort((left, right) => {
      const leftCompleted = record.tasks[left.id]?.completed ? 1 : 0;
      const rightCompleted = record.tasks[right.id]?.completed ? 1 : 0;
      if (leftCompleted !== rightCompleted) {
        return leftCompleted - rightCompleted;
      }
      return left.order - right.order;
    });

    const taskCards = sortedTasks
      .map((task) => {
        const taskState = record.tasks[task.id];
        const draft = state.noteDrafts[task.id] || "";
        const taskTags = getTaskTags(task.id);
        const notesHtml = taskState.notes.length
          ? taskState.notes
              .map(
                (note) => `
                  <div class="task-note-item">
                    <div class="task-note-row">
                      <span class="note-time-chip">${formatDateTime(note.createdAt)}</span>
                      <button
                        type="button"
                        class="delete-note"
                        data-action="delete-note"
                        data-task-id="${task.id}"
                        data-note-id="${note.id}"
                        title="删除这条备注"
                        aria-label="删除这条备注"
                    >
                      <span class="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                    <div class="task-note-markdown">${renderTaskNoteMarkdown(note.text)}</div>
                  </div>
                `,
              )
              .join("")
          : "";

        return `
          <article
            class="task-card ${taskState.completed ? "is-task-completed" : ""}"
            style="--task-accent: ${task.color};"
            data-task-card="${task.id}"
          >
            <button
              type="button"
              class="task-accent-trigger"
              aria-label="${escapeAttribute(task.name)} 颜色设置"
              data-action="toggle-task-palette"
              data-task-id="${task.id}"
            ></button>
            <div class="task-row">
              <div class="task-title-group">
                <button
                  type="button"
                  class="task-completion-toggle ${taskState.completed ? "is-completed" : ""}"
                  data-action="toggle-task"
                  data-task-id="${task.id}"
                  aria-label="${taskState.completed ? "标记为未完成" : "标记为已完成"}"
                >
                  <span class="material-symbols-outlined">check</span>
                </button>
                <div class="task-meta-stack">
                  <h3 class="task-title">${task.name}</h3>
                  ${renderTaskTags(taskTags)}
                </div>
              </div>
              <div class="task-head-actions">
                <button
                  type="button"
                  class="task-menu-trigger ${state.activeTaskMenuId === task.id ? "is-open" : ""}"
                  data-action="toggle-task-menu"
                  data-task-id="${task.id}"
                  aria-label="${escapeAttribute(task.name)} 更多操作"
                  aria-expanded="${state.activeTaskMenuId === task.id ? "true" : "false"}"
                >
                  <span class="material-symbols-outlined">more_horiz</span>
                </button>
                <div class="task-menu-panel ${state.activeTaskMenuId === task.id ? "is-open" : ""}">
                  <button
                    type="button"
                    class="task-menu-item"
                    data-action="start-task-rename"
                    data-task-id="${task.id}"
                  >
                    <span class="material-symbols-outlined">edit</span>
                    <span>编辑</span>
                  </button>
                  <button
                    type="button"
                    class="task-menu-item"
                    data-action="archive-task"
                    data-task-id="${task.id}"
                  >
                    <span class="material-symbols-outlined">inventory_2</span>
                    <span>存档</span>
                  </button>
                  <button
                    type="button"
                    class="task-menu-item is-danger"
                    data-action="request-delete-task"
                    data-task-id="${task.id}"
                  >
                    <span class="material-symbols-outlined">delete</span>
                    <span>删除</span>
                  </button>
                </div>
                <button
                  type="button"
                  class="task-drag-handle"
                  aria-label="拖拽排序 ${escapeAttribute(task.name)}"
                  data-drag-handle="${task.id}"
                  data-task-id="${task.id}"
                >
                  <span class="material-symbols-outlined">drag_indicator</span>
                </button>
              </div>
            </div>

            ${
              state.activePaletteTaskId === task.id
                ? `
                  <div class="task-palette-popover" role="group" aria-label="${escapeAttribute(task.name)} 颜色选择">
                    ${renderTaskColorPalette(task.id, task.color)}
                  </div>
                `
                : ""
            }

            <div class="note-compose">
              <textarea
                class="task-note-input"
                data-action="draft-note"
                data-task-id="${task.id}"
                maxlength="500"
                placeholder="记录本次执行的进度、问题或灵感（支持 Markdown）..."
              >${escapeHtml(draft)}</textarea>
              <div class="note-compose-footer">
                <button
                  type="button"
                  class="note-submit"
                  data-action="submit-note"
                  data-task-id="${task.id}"
                >
                  提交记录
                </button>
              </div>
            </div>
            ${notesHtml ? `<div class="task-note-list">${notesHtml}</div>` : ""}
          </article>
        `;
      })
      .join("");

    elements.taskList.innerHTML = `
      ${taskCards}
      <article class="task-card new-task-card">
        <div>
          <h3 class="task-title">+ 新建任务</h3>
          <p class="task-meta">新增后会自动加入每日打卡与周复盘。</p>
        </div>
        <form id="new-task-form" class="new-task-form">
          <input
            id="new-task-name"
            name="taskName"
            type="text"
            maxlength="20"
            placeholder="输入新任务名称"
            required
          />
          <input
            id="new-task-tags"
            name="taskTags"
            type="text"
            maxlength="120"
            placeholder="标签，多个请用逗号分隔"
          />
          <div class="new-task-color-hint">
            <span>颜色</span>
            <strong style="${state.newTaskColor ? `color:${state.newTaskColor};` : ""}">
              ${state.newTaskColor ? "已选颜色" : "随机分配"}
            </strong>
          </div>
          <button type="submit" class="add-task-submit">创建任务</button>
        </form>
      </article>
    `;

    initTaskListSortable();
  }

  function openArchiveTaskModal(taskId) {
    state.archiveDialogTaskId = taskId;
    renderArchiveTaskModal();
  }

  function openRenameTaskModal(taskId) {
    const task = state.data.taskTypes.find((item) => item.id === taskId);
    if (!task) {
      return;
    }
    state.renameDialogTaskId = taskId;
    state.taskNameDrafts[taskId] = task.name;
    state.taskTagDrafts[taskId] = getTaskTagsText(getTaskTags(task.id));
    renderRenameTaskModal();
  }

  function closeRenameTaskModal() {
    state.renameDialogTaskId = null;
    renderRenameTaskModal();
  }

  function closeArchiveTaskModal() {
    state.archiveDialogTaskId = null;
    renderArchiveTaskModal();
  }

  function openDeleteTaskModal(taskId) {
    state.deleteDialogTaskId = taskId;
    renderDeleteTaskModal();
  }

  function closeDeleteTaskModal() {
    state.deleteDialogTaskId = null;
    renderDeleteTaskModal();
  }

  function renderDeleteTaskModal() {
    if (!elements.deleteTaskModal || !elements.deleteTaskConfirm) {
      return;
    }

    const task = state.data.taskTypes.find((item) => item.id === state.deleteDialogTaskId);
    elements.deleteTaskModal.hidden = !task;
    elements.deleteTaskConfirm.disabled = !task;
    elements.deleteTaskConfirm.dataset.taskId = task?.id || "";
    elements.deleteTaskConfirm.title = task
      ? `确认永久删除 ${task.name}`
      : "确认删除";
  }

  function renderArchiveTaskModal() {
    if (!elements.archiveTaskModal || !elements.archiveTaskConfirm) {
      return;
    }

    const task = state.data.taskTypes.find((item) => item.id === state.archiveDialogTaskId);
    elements.archiveTaskModal.hidden = !task;
    elements.archiveTaskConfirm.disabled = !task;
    elements.archiveTaskConfirm.dataset.taskId = task?.id || "";
    elements.archiveTaskConfirm.title = task
      ? `确认存档 ${task.name}`
      : "确认存档";
  }

  function renderRenameTaskModal() {
    if (!elements.renameTaskModal || !elements.renameTaskInput || !elements.renameTaskConfirm) {
      return;
    }

    const task = state.data.taskTypes.find((item) => item.id === state.renameDialogTaskId);
    elements.renameTaskModal.hidden = !task;
    elements.renameTaskInput.value = task ? state.taskNameDrafts[task.id] || task.name : "";
    if (elements.renameTaskTagsInput) {
      elements.renameTaskTagsInput.value = task
        ? state.taskTagDrafts[task.id] || getTaskTagsText(getTaskTags(task.id))
        : "";
    }
    elements.renameTaskConfirm.disabled = !task;
    elements.renameTaskConfirm.dataset.taskId = task?.id || "";
    elements.renameTaskConfirm.title = task ? `确认编辑 ${task.name}` : "确认编辑";
  }

  function openTaskTimelineModal(taskId) {
    state.taskTimelineTaskId = taskId;
    renderTaskTimelineModal();
  }

  function closeTaskTimelineModal() {
    state.taskTimelineTaskId = null;
    renderTaskTimelineModal();
  }

  function renderTaskTimelineModal() {
    if (!elements.taskTimelineModal || !elements.taskTimelineBody || !elements.taskTimelineTitle) {
      return;
    }

    const task = state.data.taskTypes.find((item) => item.id === state.taskTimelineTaskId);
    elements.taskTimelineModal.hidden = !task;
    if (!task) {
      elements.taskTimelineTitle.textContent = "任务时间线";
      elements.taskTimelineBody.innerHTML = "";
      return;
    }

    elements.taskTimelineTitle.textContent = task.name;
    const events = getTaskTimelineEntries(task.id);
    elements.taskTimelineBody.innerHTML = `
      <div class="task-timeline-header">
        <span>${events.length} 条历史记录</span>
      </div>
      <div class="task-timeline-list">
        ${
          events.length
            ? events
                .map(
                  (entry) => `
                    <article class="task-timeline-item">
                      <div class="task-timeline-rail" aria-hidden="true">
                        <span class="task-timeline-dot ${entry.completed ? "is-complete" : ""}"></span>
                        <span class="task-timeline-line"></span>
                      </div>
                      <div class="task-timeline-content">
                        <div class="task-timeline-meta">
                          <strong>${escapeHtml(entry.dateLabel)}</strong>
                          <span class="task-timeline-status">${entry.completed ? "已完成" : "未完成"}</span>
                        </div>
                        <div class="task-timeline-notes">
                          ${
                            entry.notes.length
                              ? entry.notes
                                  .map(
                                    (note) =>
                                      `<div class="task-timeline-note-item task-note-markdown">${renderTaskNoteMarkdown(note.text)}</div>`,
                                  )
                                  .join("")
                              : '<div class="task-timeline-note-item is-empty">无备注</div>'
                          }
                        </div>
                      </div>
                    </article>
                  `,
                )
                .join("")
            : '<div class="task-timeline-empty">暂无历史记录</div>'
        }
      </div>
    `;
  }

  function getTaskTimelineEntries(taskId) {
    return Object.entries(state.data.dailyRecords)
      .map(([dateKey, record]) => {
        if (!record?.tasks?.[taskId]) {
          return null;
        }
        const taskState = migrateTaskRecord(record.tasks[taskId], record.updatedAt, dateKey);
        if (!taskState.completed && taskState.notes.length === 0) {
          return null;
        }
        return {
          dateKey,
          dateLabel: formatDisplayDate(parseLocalDate(dateKey)),
          completed: Boolean(taskState.completed),
          notes: taskState.notes,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }

  function getTaskName(taskId) {
    return (
      state.data.taskTypes.find((item) => item.id === taskId)?.name || taskId
    );
  }

  async function updateTaskCompletion(taskId) {
    const record = ensureRecord(state.selectedDate);
    record.tasks[taskId].completed = !record.tasks[taskId].completed;
    record.updatedAt = new Date().toISOString();
    persistStateSilently();
    renderControls();
    renderTaskList();
    renderWeeklyReview();
    await syncCurrentRecord(`已保存 ${getTaskName(taskId)} 的完成状态`);
  }

  function updateNoteDraft(taskId, value) {
    state.noteDrafts[taskId] = value;
  }

  function updateNoteTimeDraft(taskId, value) {
    if (!state.noteTimeDrafts) {
      state.noteTimeDrafts = {};
    }
    state.noteTimeDrafts[taskId] = normalizeNoteTimeValue(value) || getDefaultNoteTimeValue();
  }

  function updateTaskNameDraft(taskId, value) {
    state.taskNameDrafts[taskId] = value;
  }

  function updateTaskTagDraft(taskId, value) {
    state.taskTagDrafts[taskId] = value;
  }

  function toggleTaskMenu(taskId) {
    state.activeTaskMenuId = state.activeTaskMenuId === taskId ? null : taskId;
  }

  function closeTaskMenu() {
    state.activeTaskMenuId = null;
  }

  async function submitTaskNote(taskId) {
    const draft = (state.noteDrafts[taskId] || "").trim();
    if (!draft) {
      return;
    }

    const record = ensureRecord(state.selectedDate);
    const createdAt = buildNoteCreatedAt(state.noteTimeDrafts?.[taskId] || "");
    record.tasks[taskId].notes.push({
      id: `note-${Date.now()}`,
      text: draft,
      createdAt,
    });
    record.updatedAt = new Date().toISOString();
    state.noteDrafts[taskId] = "";
    state.noteTimeDrafts[taskId] = "";
    persistStateSilently();
    renderTaskList();
    renderWeeklyReview();
    await syncCurrentRecord(`已追加 ${getTaskName(taskId)} 的备注`);
  }

  async function deleteTaskNote(taskId, noteId) {
    const record = ensureRecord(state.selectedDate);
    const taskState = record.tasks[taskId];
    if (!taskState) {
      return;
    }
    taskState.notes = taskState.notes.filter((note) => note.id !== noteId);
    record.updatedAt = new Date().toISOString();
    persistStateSilently();
    renderTaskList();
    renderWeeklyReview();
    await syncCurrentRecord(`已删除 ${getTaskName(taskId)} 的备注`);
  }

  async function addTask(taskName, taskTagsInput = "") {
    const normalizedName = taskName.trim();
    if (!normalizedName) {
      return;
    }

    const id = `task-${Date.now()}`;
    const nextTask = {
      id,
      name: normalizedName,
      order: state.data.taskTypes.length + 1,
      color: state.newTaskColor || getRandomPaletteColor(),
      archived: false,
      archivedAt: "",
    };
    state.data.taskTypes = [...state.data.taskTypes, nextTask];
    const nextTags = normalizeTaskTagsInput(taskTagsInput);
    setTaskTags(id, nextTags);
    Object.values(state.data.dailyRecords).forEach((record) => {
      record.tasks[id] = { completed: false, notes: [] };
    });
    ensureRecord(state.selectedDate);
    state.newTaskColor = "";
    persistStateSilently();
    render();
    await syncTaskCreate(nextTask, `已创建任务：${normalizedName}`);
    if (nextTags.length > 0) {
      await syncTaskTagPreferences(`已创建任务：${normalizedName}`);
    }
  }

  async function renameTask(taskId) {
    const task = state.data.taskTypes.find((item) => item.id === taskId);
    const draft = String(state.taskNameDrafts[taskId] || "").trim();
    const nextTags = normalizeTaskTagsInput(state.taskTagDrafts[taskId] || "");
    const currentTags = getTaskTags(taskId);
    const nameChanged = Boolean(task && draft && draft !== task.name);
    const tagsChanged = JSON.stringify(nextTags) !== JSON.stringify(currentTags);

    if (!task || (!draft && !tagsChanged) || (!nameChanged && !tagsChanged)) {
      closeRenameTaskModal();
      return;
    }

    if (nameChanged) {
      task.name = draft;
    }
    if (tagsChanged) {
      setTaskTags(taskId, nextTags);
    }
    closeRenameTaskModal();
    persistStateSilently();
    render();
    if (nameChanged) {
      await syncTaskUpdate(task, tagsChanged ? `已更新任务：${task.name}` : `已重命名任务：${task.name}`);
    } else {
      setSaveStatus(`已更新 ${task.name} 的标签`);
    }
    if (tagsChanged) {
      await syncTaskTagPreferences(
        nameChanged ? `已更新任务：${task.name}` : `已更新 ${task.name} 的标签`,
      );
    }
  }

  function cancelTaskRename(taskId) {
    delete state.taskNameDrafts[taskId];
    delete state.taskTagDrafts[taskId];
    if (state.renameDialogTaskId === taskId) {
      closeRenameTaskModal();
    }
  }

  function startTaskRename(taskId) {
    openRenameTaskModal(taskId);
  }

  async function reorderTasksByDrag(sourceTaskId, targetTaskId) {
    if (!sourceTaskId || !targetTaskId || sourceTaskId === targetTaskId) {
      return;
    }

    const fullSortedTasks = [...state.data.taskTypes].sort((a, b) => a.order - b.order);
    const activeTasks = fullSortedTasks.filter((task) => !isTaskArchived(task));
    const sourceIndex = activeTasks.findIndex((task) => task.id === sourceTaskId);
    const targetIndex = activeTasks.findIndex((task) => task.id === targetTaskId);

    if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
      return;
    }

    const reorderedActiveTasks = [...activeTasks];
    const [movedTask] = reorderedActiveTasks.splice(sourceIndex, 1);
    reorderedActiveTasks.splice(targetIndex, 0, movedTask);

    let activeCursor = 0;
    const mergedTasks = fullSortedTasks.map((task) => {
      if (isTaskArchived(task)) {
        return task;
      }
      const nextTask = reorderedActiveTasks[activeCursor];
      activeCursor += 1;
      return nextTask;
    });

    const changedTasks = [];
    mergedTasks.forEach((task, index) => {
      const nextOrder = index + 1;
      if (task.order !== nextOrder) {
        task.order = nextOrder;
        changedTasks.push(task);
      }
    });

    if (changedTasks.length === 0) {
      return;
    }

    state.data.taskTypes = mergedTasks;
    persistStateSilently();
    render();

    await Promise.all(
      changedTasks.map((task) =>
        syncTaskUpdate(task, `已调整 ${task.name} 的顺序`),
      ),
    );
  }

  async function reorderTasksToMatchOrder(orderedTaskIds) {
    const orderMap = new Map(orderedTaskIds.map((taskId, index) => [taskId, index + 1]));
    const changedTasks = [];

    state.data.taskTypes.forEach((task) => {
      if (!orderMap.has(task.id)) {
        return;
      }
      const nextOrder = orderMap.get(task.id);
      if (task.order !== nextOrder) {
        task.order = nextOrder;
        changedTasks.push(task);
      }
    });

    if (changedTasks.length === 0) {
      renderTaskList();
      return;
    }

    state.data.taskTypes.sort((a, b) => a.order - b.order);
    persistStateSilently();
    render();

    await Promise.all(
      changedTasks.map((task) =>
        syncTaskUpdate(task, `已调整 ${task.name} 的顺序`),
      ),
    );
  }

  function initTaskListSortable() {
    if (!elements.taskList || typeof window.Sortable === "undefined") {
      return;
    }

    if (taskListSortable) {
      taskListSortable.destroy();
    }

    taskListSortable = window.Sortable.create(elements.taskList, {
      animation: 220,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      draggable: ".task-card:not(.new-task-card)",
      handle: ".task-drag-handle",
      ghostClass: "task-card-sort-ghost",
      chosenClass: "task-card-sort-chosen",
      dragClass: "task-card-sort-drag",
      filter: ".new-task-card",
      preventOnFilter: false,
      onEnd() {
        const orderedTaskIds = [...elements.taskList.querySelectorAll(".task-card:not(.new-task-card)")]
          .map((card) => card.dataset.taskCard)
          .filter(Boolean);

        if (orderedTaskIds.length === 0) {
          renderTaskList();
          return;
        }

        void reorderTasksToMatchOrder(orderedTaskIds);
      },
    });
  }

  async function updateTaskColor(taskId, color) {
    const task = state.data.taskTypes.find((item) => item.id === taskId);
    if (!task || task.color === color) {
      return;
    }
    task.color = color;
    persistStateSilently();
    renderTaskList();
    renderWeeklyReview();
    await syncTaskUpdate(task, `已更新 ${task.name} 的颜色`);
  }

  async function deleteTask(taskId) {
    const task = state.data.taskTypes.find((item) => item.id === taskId);
    if (!task) {
      return;
    }
    const deletedTaskSnapshot = structuredClone(task);
    const deletedTaskTags = getTaskTags(taskId);
    const deletedTaskRecords = Object.entries(state.data.dailyRecords).reduce(
      (accumulator, [dateKey, record]) => {
        if (!record?.tasks?.[taskId]) {
          return accumulator;
        }
        accumulator[dateKey] = structuredClone(record.tasks[taskId]);
        return accumulator;
      },
      {},
    );
    closeDeleteTaskModal();
    clearTaskTags(taskId);
    permanentlyRemoveTaskFromLocalState(taskId);
    persistStateSilently();
    render();
    setUndoAction({
      undo: async () => {
        state.data.taskTypes.push(deletedTaskSnapshot);
        state.data.taskTypes.sort((a, b) => a.order - b.order);
        setTaskTags(taskId, deletedTaskTags);
        Object.entries(deletedTaskRecords).forEach(([dateKey, taskState]) => {
          const record = ensureRecord(dateKey);
          record.tasks[taskId] = taskState;
        });
        persistStateSilently();
        render();
        await syncTaskCreate(deletedTaskSnapshot, `已撤销删除：${deletedTaskSnapshot.name}`);
        await syncTaskTagPreferences(`已撤销删除：${deletedTaskSnapshot.name}`);
        await Promise.all(
          Object.keys(deletedTaskRecords).map((dateKey) => syncRecordByDate(dateKey)),
        );
        setSaveStatus(`已撤销删除 ${deletedTaskSnapshot.name}`, "success");
      },
    });
    await syncTaskDelete(taskId, `已删除任务：${task.name}`);
    await syncTaskTagPreferences(`已删除任务：${task.name}`);
  }

  async function archiveTask(taskId) {
    const task = state.data.taskTypes.find((item) => item.id === taskId);
    if (!task || isTaskArchived(task)) {
      return;
    }

    closeArchiveTaskModal();
    delete state.recentlyRestoredTaskIds[taskId];
    const previousState = {
      archived: Boolean(task.archived),
      archivedAt: task.archivedAt || "",
    };
    task.archived = true;
    task.archivedAt = new Date().toISOString();
    persistStateSilently();
    render();
    setUndoAction({
      undo: async () => {
        task.archived = previousState.archived;
        task.archivedAt = previousState.archivedAt;
        persistStateSilently();
        render();
        await syncTaskUpdate(task, `已撤销存档：${task.name}`);
      },
    });
    await syncTaskUpdate(task, `已存档任务：${task.name}`);
  }

  async function restoreTask(taskId) {
    const task = state.data.taskTypes.find((item) => item.id === taskId);
    if (!task || !isTaskArchived(task)) {
      return;
    }

    task.archived = false;
    task.archivedAt = "";
    state.recentlyRestoredTaskIds[taskId] = true;
    persistStateSilently();
    render();
    setUndoAction({
      undo: async () => {
        task.archived = true;
        task.archivedAt = new Date().toISOString();
        persistStateSilently();
        render();
        await syncTaskUpdate(task, `已撤销恢复：${task.name}`);
      },
    });
    await syncTaskUpdate(task, `已恢复任务：${task.name}`);
  }

  return {
    renderTaskList,
    renderTaskColorPalette,
    renderNewTaskColorPalette,
    openArchiveTaskModal,
    openRenameTaskModal,
    closeRenameTaskModal,
    closeArchiveTaskModal,
    openDeleteTaskModal,
    closeDeleteTaskModal,
    renderDeleteTaskModal,
    renderArchiveTaskModal,
    renderRenameTaskModal,
    openTaskTimelineModal,
    closeTaskTimelineModal,
    renderTaskTimelineModal,
    getTaskTimelineEntries,
    getTaskName,
    updateTaskCompletion,
    updateNoteDraft,
    updateNoteTimeDraft,
    updateTaskNameDraft,
    updateTaskTagDraft,
    toggleTaskMenu,
    closeTaskMenu,
    submitTaskNote,
    deleteTaskNote,
    addTask,
    renameTask,
    cancelTaskRename,
    startTaskRename,
    reorderTasksByDrag,
    reorderTasksToMatchOrder,
    updateTaskColor,
    deleteTask,
    archiveTask,
    restoreTask,
  };
}
