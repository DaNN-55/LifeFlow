// A backup is a versioned document, not a partial update. Validate every entry
// before any remote mutation so a bad later entry cannot destroy earlier data.
function check(condition, field) {
  if (!condition) throw new Error(`备份格式不正确或版本不受支持：${field}`);
}

function object(value, field) {
  check(value !== null && typeof value === "object" && !Array.isArray(value), field);
  return value;
}

function string(value, min, max, field) {
  check(typeof value === "string" && value.length >= min && value.length <= max, field);
}

function optionalString(value, max, field) {
  if (value !== undefined) string(value, 0, max, field);
}

function dateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function timestamp(value, field) {
  check(typeof value === "string" && /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?Z$/.test(value)
    && dateKey(value.slice(0, 10)) && !Number.isNaN(Date.parse(value)), field);
}

function preferences(value) {
  object(value, "preferences");
  if (value.theme !== undefined) check(["light", "dark"].includes(value.theme), "preferences.theme");
  if (value.sidebar !== undefined) {
    object(value.sidebar, "preferences.sidebar");
    for (const key of ["calendar", "github", "freshNews", "favorites", "weather", "stock"]) {
      if (value.sidebar[key] !== undefined) check(typeof value.sidebar[key] === "boolean", `sidebar.${key}`);
    }
  }
  if (value.content !== undefined) {
    object(value.content, "preferences.content");
    for (const key of ["readItems", "hiddenSources"]) {
      if (value.content[key] === undefined) continue;
      Object.values(object(value.content[key], `content.${key}`)).forEach((entry) => string(entry, 0, Infinity, key));
    }
  }
  if (value.profile !== undefined) {
    object(value.profile, "preferences.profile");
    optionalString(value.profile.birthDate, 32, "profile.birthDate");
    const years = value.profile.lifeExpectancyYears;
    if (years !== undefined) check(Number.isInteger(years) && years >= 1 && years <= 150, "profile.lifeExpectancyYears");
  }
  if (value.widgets !== undefined) {
    object(value.widgets, "preferences.widgets");
    const limits = {
      favorites: { title: 80, channel: 40 }, github: { owner: 120, profileUrl: 300 },
      weather: { title: 80, locationQuery: 120 }, stock: { title: 80, symbols: 300 },
    };
    for (const [widget, fields] of Object.entries(limits)) {
      if (value.widgets[widget] === undefined) continue;
      const entry = object(value.widgets[widget], `widgets.${widget}`);
      for (const [key, max] of Object.entries(fields)) optionalString(entry[key], max, `widgets.${widget}.${key}`);
    }
  }
  if (value.sync !== undefined) {
    object(value.sync, "preferences.sync");
    for (const key of ["lastSuccessfulSyncAt", "lastSyncAttemptAt"]) optionalString(value.sync[key], Infinity, `sync.${key}`);
    if (value.sync.notices !== undefined) {
      check(Array.isArray(value.sync.notices) && value.sync.notices.length <= 12, "sync.notices");
      for (const notice of value.sync.notices) {
        object(notice, "sync.notices[]");
        string(notice.message, 0, 200, "notice.message");
        optionalString(notice.id, Infinity, "notice.id");
        optionalString(notice.tone, 32, "notice.tone");
        optionalString(notice.createdAt, Infinity, "notice.createdAt");
      }
    }
  }
}

export function validateBackup(data) {
  object(data, "data");
  check(data.version === 6, "version");
  check(Array.isArray(data.taskTypes), "taskTypes");
  object(data.dailyRecords, "dailyRecords");
  object(data.weeklySummaries, "weeklySummaries");
  const ids = new Set();
  for (const task of data.taskTypes) {
    object(task, "taskTypes[]");
    string(task.id, 1, 64, "task.id");
    check(!ids.has(task.id), "重复 task.id");
    ids.add(task.id);
    string(task.name, 1, 40, "task.name");
    string(task.color, 1, 64, "task.color");
    const order = task.order ?? task.display_order ?? 1;
    check(Number.isInteger(order) && order > 0, "task.order");
    if (task.archived !== undefined) check(typeof task.archived === "boolean", "task.archived");
    const archivedAt = task.archivedAt ?? task.archived_at;
    if (archivedAt !== undefined && archivedAt !== null && archivedAt !== "") timestamp(archivedAt, "task.archivedAt");
    if (task.tags !== undefined) {
      check(Array.isArray(task.tags) && task.tags.length <= 6, "task.tags");
      task.tags.forEach((tag) => string(tag, 1, 24, "task.tags[]"));
    }
    optionalString(task.icon, 48, "task.icon");
    const events = task.lifecycleEvents ?? task.lifecycle_events ?? [];
    check(Array.isArray(events), "task.lifecycleEvents");
    for (const event of events) {
      object(event, "lifecycleEvent");
      string(event.taskId, 1, 64, "lifecycleEvent.taskId");
      check(["archive", "restore"].includes(event.type), "lifecycleEvent.type");
      timestamp(event.changedAt, "lifecycleEvent.changedAt");
    }
  }
  for (const [date, record] of Object.entries(data.dailyRecords)) {
    check(dateKey(date), `dailyRecords.${date}`);
    object(record, `dailyRecords.${date}`);
    if (record.date !== undefined) check(record.date === date, "record.date");
    const tasks = object(record.tasks ?? record.payload?.tasks, `dailyRecords.${date}.tasks`);
    for (const state of Object.values(tasks)) {
      object(state, "taskState");
      if (state.completed !== undefined) check(typeof state.completed === "boolean", "taskState.completed");
      if (state.notes === undefined) continue;
      check(Array.isArray(state.notes), "taskState.notes");
      for (const note of state.notes) {
        object(note, "note");
        string(note.id, 1, Infinity, "note.id");
        string(note.text, 1, 500, "note.text");
        string(note.createdAt, 1, Infinity, "note.createdAt");
      }
    }
  }
  for (const [week, summary] of Object.entries(data.weeklySummaries)) {
    check(/^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(week), `weeklySummaries.${week}`);
    object(summary, `weeklySummaries.${week}`);
    if (summary.week !== undefined) check(summary.week === week, "summary.week");
    string(summary.content, 0, Infinity, "summary.content");
  }
  if (data.preferences !== undefined) preferences(data.preferences);
  return data;
}
