function getStartOfWeek(date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekRangeFromWeekValue(weekValue) {
  const [yearPart, weekPart] = String(weekValue).split("-W");
  const year = Number(yearPart);
  const week = Number(weekPart);
  const januaryFourth = new Date(year, 0, 4);
  const firstWeekStart = getStartOfWeek(januaryFourth);
  const start = addDays(firstWeekStart, (week - 1) * 7);
  const end = addDays(start, 6);
  return { start, end };
}

module.exports = {
  addDays,
  formatDateKey,
  getStartOfWeek,
  getWeekRangeFromWeekValue,
};
