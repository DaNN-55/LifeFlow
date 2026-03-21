export function createWeeklyModule(deps) {
  const {
    state,
    elements,
    escapeHtml,
    formatDateTime,
    formatMonthDay,
    formatWeekRangeText,
    parseLocalDate,
    aggregateWeek,
    aggregateMonth,
    getWeeklyVisibleTasks,
    getTaskTags,
    isTaskArchived,
    getWeeklySummaryDraft,
    getWeeklySummaryMode,
  } = deps;
  const markdownRenderer =
    typeof window !== "undefined" && typeof window.markdownit === "function"
      ? window.markdownit({
          html: false,
          breaks: true,
          linkify: true,
          typographer: true,
        })
      : null;

  function renderWeeklySummaryMarkdown(markdown) {
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

  function renderWeeklyReview() {
    const aggregation = getSelectedReviewAggregation();
    const weeklyTasks = getFilteredWeeklyTasks(aggregation);
    if (weeklyTasks.length === 0) {
      elements.weeklyReviewList.innerHTML = `
        <article class="review-card">
          <div class="review-card-header">
            <div>
              <h3 class="review-title">暂无匹配结果</h3>
            </div>
          </div>
          <div class="review-notes">
            <div class="review-note-item is-empty">
              <span class="review-note-marker" aria-hidden="true"></span>
              <span class="review-note-date">-</span>
              <div class="review-note-copy">
                <p class="review-note-text">尝试切换周/月范围，或放宽搜索与筛选条件。</p>
              </div>
            </div>
          </div>
        </article>
      `;
      return;
    }
    elements.weeklyReviewList.innerHTML = weeklyTasks
      .map((task) => {
        const notes = aggregation.notesByTask[task.id];
        const noteHtml = notes.length
          ? notes
              .map(
                (item) => `
                  <div class="review-note-item">
                    <span class="review-note-marker" aria-hidden="true"></span>
                    <span class="review-note-date">${item.dateLabel}</span>
                    <div class="review-note-copy">
                      <p class="review-note-text">${escapeHtml(item.note)}</p>
                    </div>
                  </div>
                `,
              )
              .join("")
          : `
              <div class="review-note-item is-empty">
                <span class="review-note-marker" aria-hidden="true"></span>
                <span class="review-note-date">-</span>
                <div class="review-note-copy">
                  <p class="review-note-text">暂无复盘备注</p>
                </div>
              </div>
            `;

        return `
          <article class="review-card" style="--task-accent: ${task.color};">
            <div class="review-card-header">
              <div class="review-title-row">
                <h3 class="review-title">${task.name}</h3>
                ${
                  getTaskTags(task.id).length
                    ? `<div class="task-tag-row review-tag-row">${getTaskTags(task.id)
                        .map((tag) => `<span class="task-tag">#${escapeHtml(tag)}</span>`)
                        .join("")}</div>`
                    : ""
                }
              </div>
              <div class="review-summary">
                ${
                  isTaskArchived(task)
                    ? '<span class="review-chip is-archived">已存档</span>'
                    : ""
                }
                ${
                  isTaskArchived(task)
                    ? `
                      <button
                        type="button"
                        class="task-archive review-restore-button"
                        data-action="restore-task"
                        data-task-id="${task.id}"
                      >
                        恢复
                      </button>
                    `
                    : ""
                }
                <span class="review-chip">${aggregation.completionCounts[task.id]} / ${aggregation.totalDays} DAYS</span>
                <span class="review-chip">${notes.length} NOTES</span>
              </div>
            </div>
            <div class="review-notes">${noteHtml}</div>
          </article>
        `;
      })
      .join("");
  }

  function getFilteredWeeklyTasks(aggregation) {
    const weeklyTasks = getWeeklyVisibleTasks(aggregation);

    return weeklyTasks.filter((task) => {
      const notes = aggregation.notesByTask[task.id] || [];
      const completionCount = aggregation.completionCounts[task.id] || 0;

      if (
        state.weeklyFilters.taskId !== "all" &&
        state.weeklyFilters.taskId !== task.id
      ) {
        return false;
      }

      if (
        state.weeklyFilters.archive === "archived" &&
        !isTaskArchived(task)
      ) {
        return false;
      }
      if (
        state.weeklyFilters.archive === "active" &&
        isTaskArchived(task)
      ) {
        return false;
      }
      if (
        state.weeklyFilters.completion === "completed" &&
        completionCount === 0
      ) {
        return false;
      }
      if (
        state.weeklyFilters.completion === "incomplete" &&
        completionCount > 0
      ) {
        return false;
      }
      return true;
    });
  }

  function getSelectedReviewAggregation() {
    if (state.reviewMode === "month") {
      return aggregateMonth(state.selectedMonth);
    }
    return aggregateWeek(state.selectedWeek);
  }

  function normalizeWeeklyAggregation(payload) {
    const presenceCounts = {};
    const completionCounts = {};
    const notesByTask = {};
    const eventsByTask = {};

    state.data.taskTypes.forEach((task) => {
      presenceCounts[task.id] = Number(payload?.presenceCounts?.[task.id] || 0);
      completionCounts[task.id] = Number(
        payload?.completionCounts?.[task.id] || 0,
      );
      notesByTask[task.id] = Array.isArray(payload?.notesByTask?.[task.id])
        ? payload.notesByTask[task.id].map((item) => ({
            dateLabel: formatMonthDay(parseLocalDate(item.date)),
            note: item.text,
          }))
        : [];
      eventsByTask[task.id] = [];
    });

    return { presenceCounts, completionCounts, notesByTask, eventsByTask, totalDays: 7 };
  }

  function renderWeeklyFilterOptions() {
    elements.weeklyTaskFilter.innerHTML = [
      '<option value="all">全部任务</option>',
      ...state.data.taskTypes.map(
        (task) =>
          `<option value="${task.id}">${escapeHtml(task.name)}</option>`,
      ),
    ].join("");
  }

  function renderWeeklySummaryContent() {
    const savedContent = state.data.weeklySummaries[state.selectedWeek]?.content || "";
    const hasSavedContent = Boolean(savedContent);
    const isViewMode =
      hasSavedContent && getWeeklySummaryMode(state.selectedWeek) === "view";

    elements.weeklySummaryInput.hidden = isViewMode;
    elements.weeklySummaryDisplay.hidden = !isViewMode;
    elements.weeklySummaryDisplay.innerHTML = renderWeeklySummaryMarkdown(savedContent);
    elements.weeklySummaryEdit.hidden = !hasSavedContent || !isViewMode;
    elements.weeklySummarySave.hidden = isViewMode;
    elements.weeklySummarySave.textContent = "保存总结";

    elements.weeklySummaryCard.classList.toggle("is-empty", !hasSavedContent);
    elements.weeklySummaryCard.classList.toggle(
      "is-editing",
      hasSavedContent && !isViewMode,
    );
    elements.weeklySummaryCard.classList.toggle("is-saved", isViewMode);
  }

  function renderWeeklySummaryMeta() {
    if (!elements.weeklySummaryMeta) {
      return;
    }

    const savedSummary = state.data.weeklySummaries[state.selectedWeek];
    const savedContent = savedSummary?.content || "";
    const draftContent = getWeeklySummaryDraft(state.selectedWeek);
    const hasUnsavedChanges = draftContent !== savedContent;

    let metaText = `当前周：${formatWeekRangeText(state.selectedWeek)}`;
    if (savedSummary?.updatedAt) {
      metaText += ` · 已保存 ${formatDateTime(savedSummary.updatedAt)}`;
    } else {
      metaText += " · 尚未保存";
    }
    if (hasUnsavedChanges) {
      metaText += " · 有未保存修改";
    }

    elements.weeklySummaryMeta.textContent = metaText;
    elements.weeklySummaryMeta.classList.toggle("is-dirty", hasUnsavedChanges);
  }

  function openWeeklySummarySaveModal() {
    state.weeklySummarySaveDialogOpen = true;
    renderWeeklySummarySaveModal();
  }

  function closeWeeklySummarySaveModal() {
    state.weeklySummarySaveDialogOpen = false;
    renderWeeklySummarySaveModal();
  }

  function renderWeeklySummarySaveModal() {
    if (!elements.weeklySummarySaveModal || !elements.weeklySummarySaveConfirm) {
      return;
    }

    const content = getWeeklySummaryDraft(state.selectedWeek).trim();
    elements.weeklySummarySaveModal.hidden = !state.weeklySummarySaveDialogOpen;
    elements.weeklySummarySaveConfirm.disabled = !content;
    elements.weeklySummarySaveConfirm.title = content
      ? `确认保存 ${formatWeekRangeText(state.selectedWeek)} 的周总结`
      : "请先填写周总结内容";
  }

  return {
    renderWeeklyReview,
    getFilteredWeeklyTasks,
    getSelectedReviewAggregation,
    normalizeWeeklyAggregation,
    renderWeeklyFilterOptions,
    renderWeeklySummaryContent,
    renderWeeklySummaryMeta,
    openWeeklySummarySaveModal,
    closeWeeklySummarySaveModal,
    renderWeeklySummarySaveModal,
  };
}
