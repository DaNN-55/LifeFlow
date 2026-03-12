export function createAggregationModule(deps) {
  const {
    state,
    addDays,
    formatDateKey,
    formatMonthDay,
    getDaySpan,
    getMonthRange,
    getWeekRangeFromWeekValue,
    getActiveTaskTypes,
    migrateTaskRecord,
    parseIsoDate,
  } = deps;

  function aggregateRange(start, end) {
    const presenceCounts = {};
    const completionCounts = {};
    const notesByTask = {};
    const eventsByTask = {};

    state.data.taskTypes.forEach((task) => {
      presenceCounts[task.id] = 0;
      completionCounts[task.id] = 0;
      notesByTask[task.id] = [];
      eventsByTask[task.id] = [];
    });

    for (
      let current = new Date(start);
      current <= end;
      current = addDays(current, 1)
    ) {
      const dateKey = formatDateKey(current);
      const record = state.data.dailyRecords[dateKey];
      if (!record) {
        continue;
      }

      state.data.taskTypes.forEach((task) => {
        const existsInRecord = Object.prototype.hasOwnProperty.call(
          record.tasks,
          task.id,
        );
        const taskState = migrateTaskRecord(
          record.tasks[task.id],
          record.updatedAt,
          dateKey,
        );
        if (existsInRecord) {
          presenceCounts[task.id] += 1;
        }
        if (taskState.completed) {
          completionCounts[task.id] += 1;
        }
        eventsByTask[task.id].push({
          dateKey,
          dateLabel: formatMonthDay(current),
          completed: Boolean(taskState.completed),
          notes: taskState.notes.map((note) => ({
            text: note.text,
            createdAt: note.createdAt,
          })),
          notePreview: taskState.notes.map((note) => note.text).join(" "),
        });
        taskState.notes.forEach((note) => {
          notesByTask[task.id].push({
            dateLabel: formatMonthDay(parseIsoDate(note.createdAt) || current),
            note: note.text,
          });
        });
      });
    }

    return {
      presenceCounts,
      completionCounts,
      notesByTask,
      eventsByTask,
      totalDays: getDaySpan(start, end),
    };
  }

  function aggregateWeek(weekValue) {
    const range = getWeekRangeFromWeekValue(weekValue);
    return aggregateRange(range.start, range.end);
  }

  function aggregateMonth(monthValue) {
    const range = getMonthRange(monthValue);
    return aggregateRange(range.start, range.end);
  }

  function getCompletedCount(record) {
    return getActiveTaskTypes().reduce((count, task) => {
      return count + (record.tasks[task.id]?.completed ? 1 : 0);
    }, 0);
  }

  return {
    aggregateWeek,
    aggregateMonth,
    getCompletedCount,
  };
}
