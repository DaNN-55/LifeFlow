export function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTodayDateString() {
  return formatDateKey(new Date());
}

export function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function parseLocalDate(dateString) {
  const [year, month, day] = String(dateString || "").split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function parseIsoDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

export function formatDisplayDate(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

export function formatMonthDay(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
  }).format(date);
}

export function formatTime(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatDateTime(value) {
  const date = parseIsoDate(value);
  if (!date) {
    return "--";
  }
  return `${formatMonthDay(date)} ${formatTime(date)}`;
}

export function getStartOfWeek(date) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function formatWeekInputValue(date) {
  const start = getStartOfWeek(date);
  const yearStart = new Date(start.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(((start - getStartOfWeek(yearStart)) / 86400000 + 1) / 7);
  return `${start.getFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

export function formatMonthValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function getMonthRange(monthValue) {
  const [year, month] = String(monthValue).split("-").map(Number);
  const start = new Date(year, (month || 1) - 1, 1);
  const end = new Date(year, month || 1, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return { start, end };
}

export function getWeekRangeFromWeekValue(weekValue) {
  const [yearPart, weekPart] = String(weekValue).split("-W");
  const year = Number(yearPart);
  const week = Number(weekPart);
  const start = getStartOfWeek(new Date(year, 0, 1));
  start.setDate(start.getDate() + (week - 1) * 7);
  const end = addDays(start, 6);
  return { start, end };
}

export function formatWeekRangeText(weekValue) {
  const range = getWeekRangeFromWeekValue(weekValue);
  return `${formatMonthDay(range.start)}-${formatMonthDay(range.end)}`;
}

export function formatMonthRangeText(monthValue) {
  const range = getMonthRange(monthValue);
  return `${range.start.getFullYear()}年${range.start.getMonth() + 1}月`;
}

export function getWeeklyRangeOptions() {
  const options = [];
  const today = new Date();
  const currentWeekStart = getStartOfWeek(today);
  const start = getStartOfWeek(new Date(today.getFullYear(), 1, 1));

  for (let cursor = new Date(start); cursor <= currentWeekStart; cursor = addDays(cursor, 7)) {
    const value = formatWeekInputValue(cursor);
    options.push({
      value,
      label: formatWeekRangeText(value),
    });
  }

  return options;
}

export function getMonthlyRangeOptions() {
  const options = [];
  const today = new Date();
  const start = new Date(today.getFullYear(), 1, 1);
  const current = new Date(today.getFullYear(), today.getMonth(), 1);

  for (let cursor = new Date(start); cursor <= current; cursor.setMonth(cursor.getMonth() + 1)) {
    const value = formatMonthValue(cursor);
    options.push({
      value,
      label: formatMonthRangeText(value),
    });
  }

  return options;
}
