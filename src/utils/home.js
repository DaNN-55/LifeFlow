import { parseIsoDate } from "./date";

export function buildWeatherPolyline(forecast = []) {
  const values = forecast.flatMap((item) => [item.max, item.min]).filter((value) => Number.isFinite(value));
  if (!values.length) {
    return "30,86 250,86";
  }
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const range = maxValue - minValue || 1;
  return forecast
    .map((item, index) => {
      const x = 30 + (index * 220) / Math.max(forecast.length - 1, 1);
      const avg = (item.max + item.min) / 2;
      const y = 84 - ((avg - minValue) / range) * 60;
      return `${x},${y}`;
    })
    .join(" ");
}

export function buildWeatherAxis(forecast = []) {
  const values = forecast.flatMap((item) => [item.max, item.min]).filter((value) => Number.isFinite(value));
  if (!values.length) {
    return { max: "--", mid: "--", min: "--" };
  }
  const max = Math.round(Math.max(...values));
  const min = Math.round(Math.min(...values));
  const mid = Math.round((max + min) / 2);
  return { max: `${max}°`, mid: `${mid}°`, min: `${min}°` };
}

export function buildWeatherHotspots(forecast = []) {
  if (!forecast.length) {
    return [];
  }
  return forecast.map((item, index) => ({
    left: (index * 100) / Math.max(forecast.length - 1, 1),
    weekdayLabel: item.dayLabel || formatWeekday(item.date),
    dateLabel: item.dateLabel || formatMonthDayLabel(item.date),
    tempLabel: `${Math.round(item.min)}°C - ${Math.round(item.max)}°C`,
  }));
}

export function formatWeekday(dateString) {
  const date = parseIsoDate(dateString);
  if (!date) {
    return "--";
  }
  return new Intl.DateTimeFormat("zh-CN", { weekday: "long" }).format(date);
}

export function formatWeekdayShortEn(dateString) {
  const date = parseIsoDate(dateString);
  if (!date) {
    return "--";
  }
  return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date);
}

export function formatMonthDayLabel(dateString) {
  const date = parseIsoDate(dateString);
  if (!date) {
    return "--/--";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function sparklinePoints(trend) {
  if (trend === "up") {
    return "0,14 10,12 20,13 30,9 40,8 50,10 60,6 70,7 80,4";
  }
  if (trend === "down") {
    return "0,4 10,6 20,5 30,8 40,9 50,11 60,12 70,13 80,14";
  }
  return "0,9 80,9";
}
