const crypto = require("node:crypto");
const cors = require("cors");
const express = require("express");
const svgCaptcha = require("svg-captcha");
const { z } = require("zod");
const { formatDateKey, getWeekRangeFromWeekValue } = require("./lib/date");

const SESSION_COOKIE_NAME = "lifeflow_session";
const SESSION_HEADER_NAME = "x-session-id";
const SESSION_TTL_DAYS = 30;
const CAPTCHA_TTL_MS = 5 * 60 * 1000;
const WEATHER_REQUEST_TIMEOUT_MS = 6000;

const taskSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  name: z.string().min(1).max(40),
  color: z.string().min(1).max(64),
  displayOrder: z.number().int().positive().optional(),
  archived: z.boolean().optional(),
  archivedAt: z.string().datetime().nullable().optional(),
});

const dailyRecordSchema = z.object({
  tasks: z.record(
    z.object({
      completed: z.boolean().optional().default(false),
      notes: z
        .array(
          z.object({
            id: z.string().min(1),
            text: z.string().min(1),
            createdAt: z.string().min(1),
          })
        )
        .optional()
        .default([]),
    })
  ),
  mood: z.string().optional().default(""),
  dailySummary: z.string().optional().default(""),
});

const weeklySummarySchema = z.object({
  content: z.string().optional().default(""),
});

const credentialsSchema = z.object({
  username: z.string().min(3).max(64).regex(/^[^\s]+$/),
  password: z.string().min(6).max(128),
});

const authRequestSchema = credentialsSchema.extend({
  captchaId: z.string().min(1).max(128),
  captchaText: z.string().min(4).max(16),
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(6).max(128),
  newPassword: z.string().min(6).max(128),
});

const deleteAccountSchema = z.object({
  password: z.string().min(6).max(128),
});

const weatherQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  query: z.string().min(1).max(120).optional(),
});

function createApp({ config, store }) {
  const app = express();
  const captchaStore = new Map();

  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin || config.corsOrigins.length === 0 || config.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`Origin ${origin} is not allowed by CORS`));
      },
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(async (request, response, next) => {
    try {
      request.userContext = await resolveUserContext(request, store);
      next();
    } catch (error) {
      next(error);
    }
  });

  app.get("/health", async (request, response) => {
    response.json({
      ok: true,
      storage: config.useSupabase ? "supabase" : "memory",
      schemaMode: store.schemaMode || "memory",
      userId: request.userContext?.userId || "",
      authenticated: Boolean(request.userContext?.isAuthenticated),
      now: new Date().toISOString(),
    });
  });

  app.get("/api/auth/captcha", async (request, response) => {
    cleanupExpiredCaptchas(captchaStore);
    const captcha = svgCaptcha.create({
      size: 4,
      ignoreChars: "0oO1iIl",
      noise: 2,
      width: 132,
      height: 48,
      fontSize: 40,
      color: true,
      background: "#f4f4ef",
    });
    const captchaId = crypto.randomUUID();
    captchaStore.set(captchaId, {
      text: String(captcha.text || "").toLowerCase(),
      expiresAt: Date.now() + CAPTCHA_TTL_MS,
    });
    response.json({
      captcha: {
        id: captchaId,
        svg: captcha.data,
        expiresInMs: CAPTCHA_TTL_MS,
      },
    });
  });

  app.get("/api/widgets/weather", async (request, response, next) => {
    try {
      const query = weatherQuerySchema.parse(request.query || {});
      const location = await resolveWeatherLocation(request, query);
      const weatherData = await fetchJsonWithTimeout(
        `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&forecast_days=7&timezone=auto`,
        WEATHER_REQUEST_TIMEOUT_MS
      );

      const current = weatherData.current || {};
      const dailyTimes = weatherData.daily?.time || [];
      const dailyMax = weatherData.daily?.temperature_2m_max || [];
      const dailyMin = weatherData.daily?.temperature_2m_min || [];

      response.json({
        weather: {
          location: formatLocationLabel(location.city, location.district),
          temperature: Number.isFinite(current.temperature_2m)
            ? `${Math.round(current.temperature_2m)}°C`
            : "--",
          detail: weatherCodeToText(current.weather_code),
          message:
            location.source === "browser"
              ? "浏览器定位"
              : location.source === "header-ip"
                ? "网络定位"
                : "默认位置",
          forecast: dailyTimes.map((date, index) => ({
            date,
            max: dailyMax[index],
            min: dailyMin[index],
          })),
          source: location.source,
          latitude: location.latitude,
          longitude: location.longitude,
          updatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/signup", async (request, response, next) => {
    try {
      const parsed = authRequestSchema.parse(request.body);
      if (!verifyCaptcha(captchaStore, parsed.captchaId, parsed.captchaText)) {
        response.status(400).json({ error: "验证码错误或已过期" });
        return;
      }
      const existing = await store.findUserByUsername(parsed.username);
      if (existing) {
        response.status(409).json({ error: "用户名已存在" });
        return;
      }

      const user = await store.createUser({
        id: crypto.randomUUID(),
        username: parsed.username,
        password_hash: await hashPassword(parsed.password),
      });
      const session = await store.createSession(createSessionPayload(user.id));
      writeSessionCookie(request, response, session.id);
      response.status(201).json({
        user: {
          id: user.id,
          username: user.username,
        },
        session: {
          id: session.id,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/signin", async (request, response, next) => {
    try {
      const parsed = authRequestSchema.parse(request.body);
      if (!verifyCaptcha(captchaStore, parsed.captchaId, parsed.captchaText)) {
        response.status(400).json({ error: "验证码错误或已过期" });
        return;
      }
      const user = await store.findUserByUsername(parsed.username);
      if (!user || !(await verifyPassword(parsed.password, user.password_hash))) {
        response.status(401).json({ error: "用户名或密码错误" });
        return;
      }

      const session = await store.createSession(createSessionPayload(user.id));
      writeSessionCookie(request, response, session.id);
      response.json({
        user: {
          id: user.id,
          username: user.username,
        },
        session: {
          id: session.id,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/signout", async (request, response, next) => {
    try {
      const sessionId = getSessionIdFromRequest(request);
      if (sessionId) {
        await store.deleteSession(sessionId);
      }
      clearSessionCookie(request, response);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/auth/me", async (request, response) => {
    if (!request.userContext?.isAuthenticated) {
      response.status(401).json({ error: "Authentication required" });
      return;
    }

    response.json({
      user: {
        id: request.userContext.userId,
        username: request.userContext.username,
      },
      session: {
        id: request.userContext.sessionId,
      },
    });
  });

  app.get("/api/account/profile", requireAuthenticated, async (request, response, next) => {
    try {
      const profile = await store.getAccountProfile(request.userContext.userId);
      if (!profile?.user) {
        response.status(404).json({ error: "Account not found" });
        return;
      }
      response.json({
        user: {
          id: profile.user.id,
          username: profile.user.username,
          createdAt: profile.user.created_at || "",
        },
        counts: {
          tasks: Number(profile.counts?.tasks || 0),
          dailyRecords: Number(profile.counts?.dailyRecords || 0),
          weeklySummaries: Number(profile.counts?.weeklySummaries || 0),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/account/password", requireAuthenticated, async (request, response, next) => {
    try {
      const parsed = passwordChangeSchema.parse(request.body);
      const user = await store.getUserById(request.userContext.userId);
      if (!user || !(await verifyPassword(parsed.currentPassword, user.password_hash))) {
        response.status(401).json({ error: "当前密码错误" });
        return;
      }
      if (parsed.currentPassword === parsed.newPassword) {
        response.status(400).json({ error: "新密码不能与当前密码相同" });
        return;
      }
      await store.updateUserPassword(user.id, await hashPassword(parsed.newPassword));
      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/account/clear-data", requireAuthenticated, async (request, response, next) => {
    try {
      await store.clearUserData(request.userContext.userId);
      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/account/delete", requireAuthenticated, async (request, response, next) => {
    try {
      const parsed = deleteAccountSchema.parse(request.body);
      const user = await store.getUserById(request.userContext.userId);
      if (!user || !(await verifyPassword(parsed.password, user.password_hash))) {
        response.status(401).json({ error: "密码错误，无法删除账号" });
        return;
      }
      await store.deleteUserAccount(user.id);
      clearSessionCookie(request, response);
      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/tasks", requireAuthenticated, async (request, response, next) => {
    try {
      const tasks = await store.listTasks(request.userContext);
      response.json({ tasks });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/tasks", requireAuthenticated, async (request, response, next) => {
    try {
      const parsed = taskSchema.parse(request.body);
      const existingTasks = await store.listTasks(request.userContext);
      const task = {
        id: parsed.id || crypto.randomUUID(),
        name: parsed.name,
        color: parsed.color,
        display_order: parsed.displayOrder || existingTasks.length + 1,
        archived: Boolean(parsed.archived),
        archived_at: parsed.archivedAt || null,
      };
      const created = await store.createTask(request.userContext, task);
      response.status(201).json({ task: created });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/tasks/:taskId", requireAuthenticated, async (request, response, next) => {
    try {
      const parsed = taskSchema.partial().parse(request.body);
      const updated = await store.updateTask(request.userContext, request.params.taskId, {
        name: parsed.name,
        color: parsed.color,
        display_order: parsed.displayOrder,
        archived: parsed.archived,
        archived_at: parsed.archivedAt,
      });

      if (!updated) {
        response.status(404).json({ error: "Task not found" });
        return;
      }

      response.json({ task: updated });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/tasks/:taskId", requireAuthenticated, async (request, response, next) => {
    try {
      await store.deleteTask(request.userContext, request.params.taskId);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/daily-records/:date", requireAuthenticated, async (request, response, next) => {
    try {
      const date = normalizeDateParam(request.params.date);
      const record = await store.getDailyRecord(request.userContext, date);
      response.json({
        record:
          record || {
            date,
            payload: { tasks: {}, mood: "", dailySummary: "" },
            updatedAt: "",
          },
      });
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/daily-records/:date", requireAuthenticated, async (request, response, next) => {
    try {
      const date = normalizeDateParam(request.params.date);
      const payload = dailyRecordSchema.parse(request.body);
      const record = await store.upsertDailyRecord(request.userContext, date, payload);
      response.json({ record });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/weekly-review/:week", requireAuthenticated, async (request, response, next) => {
    try {
      const week = String(request.params.week);
      const range = getWeekRangeFromWeekValue(week);
      const tasks = await store.listTasks(request.userContext);
      const records = await store.listDailyRecordsBetween(
        request.userContext,
        formatDateKey(range.start),
        formatDateKey(range.end)
      );

      const presenceCounts = {};
      const completionCounts = {};
      const notesByTask = {};

      tasks.forEach((task) => {
        presenceCounts[task.id] = 0;
        completionCounts[task.id] = 0;
        notesByTask[task.id] = [];
      });

      records.forEach((record) => {
        tasks.forEach((task) => {
          const taskState = record.payload?.tasks?.[task.id];
          if (!taskState) {
            return;
          }
          presenceCounts[task.id] += 1;
          if (taskState.completed) {
            completionCounts[task.id] += 1;
          }
          for (const note of taskState.notes || []) {
            notesByTask[task.id].push({
              date: record.date,
              text: note.text,
              createdAt: note.createdAt,
            });
          }
        });
      });

      response.json({
        week,
        start: formatDateKey(range.start),
        end: formatDateKey(range.end),
        tasks,
        presenceCounts,
        completionCounts,
        notesByTask,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/weekly-summaries/:week", requireAuthenticated, async (request, response, next) => {
    try {
      const week = String(request.params.week);
      const summary = await store.getWeeklySummary(request.userContext, week);
      response.json({
        summary: summary || { week, content: "", updatedAt: "" },
      });
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/weekly-summaries/:week", requireAuthenticated, async (request, response, next) => {
    try {
      const week = String(request.params.week);
      const payload = weeklySummarySchema.parse(request.body);
      const summary = await store.upsertWeeklySummary(request.userContext, week, payload);
      response.json({ summary });
    } catch (error) {
      next(error);
    }
  });

  app.use((error, request, response, next) => {
    if (error instanceof z.ZodError) {
      response.status(400).json({ error: "Validation failed", details: error.flatten() });
      return;
    }

    if (error?.statusCode) {
      response.status(error.statusCode).json({ error: error.message });
      return;
    }

    if (error?.message?.startsWith("Origin")) {
      response.status(403).json({ error: error.message });
      return;
    }

    console.error(error);
    response.status(500).json({ error: "Internal server error" });
  });

  return app;
}

function requireAuthenticated(request, response, next) {
  if (request.userContext?.isAuthenticated) {
    next();
    return;
  }

  response.status(401).json({ error: "Authentication required" });
}

async function resolveUserContext(request, store) {
  const sessionId = getSessionIdFromRequest(request);
  if (!sessionId) {
    return { userId: "", isAuthenticated: false, username: "", sessionId: "" };
  }

  const result = await store.getSessionWithUser(sessionId);
  if (!result?.session || !result?.user) {
    return { userId: "", isAuthenticated: false, username: "", sessionId: "" };
  }

  const expiresAt = new Date(result.session.expires_at);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
    await store.deleteSession(sessionId);
    return { userId: "", isAuthenticated: false, username: "", sessionId: "" };
  }

  return {
    userId: result.user.id,
    isAuthenticated: true,
    username: result.user.username || "",
    sessionId,
  };
}

function parseCookieHeader(cookieHeader = "") {
  return String(cookieHeader)
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((accumulator, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex === -1) {
        return accumulator;
      }
      const key = part.slice(0, separatorIndex).trim();
      const value = decodeURIComponent(part.slice(separatorIndex + 1));
      accumulator[key] = value;
      return accumulator;
    }, {});
}

function getSessionIdFromRequest(request) {
  const headerSessionId = String(request.header(SESSION_HEADER_NAME) || "").trim();
  if (headerSessionId) {
    return headerSessionId;
  }
  const cookies = parseCookieHeader(request.header("cookie") || "");
  return cookies[SESSION_COOKIE_NAME] || "";
}

function createSessionPayload(userId) {
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    expires_at: new Date(
      Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString(),
  };
}

function writeSessionCookie(request, response, sessionId) {
  const maxAge = SESSION_TTL_DAYS * 24 * 60 * 60;
  const { sameSite, secure } = resolveCookiePolicy(request);
  response.append(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${maxAge}${secure ? "; Secure" : ""}`,
  );
}

function clearSessionCookie(request, response) {
  const { sameSite, secure } = resolveCookiePolicy(request);
  response.append(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=0${secure ? "; Secure" : ""}`,
  );
}

function resolveCookiePolicy(request) {
  const origin = request.header("origin") || "";
  const host = request.header("host") || "";
  try {
    if (origin) {
      const originUrl = new URL(origin);
      const requestHost = host.split(":")[0];
      if (originUrl.hostname && requestHost && originUrl.hostname !== requestHost) {
        return { sameSite: "None", secure: true };
      }
    }
  } catch (error) {
    // fall through
  }
  return { sameSite: "Lax", secure: false };
}

function cleanupExpiredCaptchas(captchaStore) {
  const now = Date.now();
  for (const [captchaId, record] of captchaStore.entries()) {
    if (!record || record.expiresAt <= now) {
      captchaStore.delete(captchaId);
    }
  }
}

function verifyCaptcha(captchaStore, captchaId, captchaText) {
  cleanupExpiredCaptchas(captchaStore);
  const record = captchaStore.get(String(captchaId || ""));
  if (!record) {
    return false;
  }
  captchaStore.delete(String(captchaId || ""));
  return String(captchaText || "").trim().toLowerCase() === record.text;
}

async function resolveWeatherLocation(request, query) {
  if (query.query) {
    const searched = await searchWeatherLocation(query.query);
    if (searched) {
      return { ...searched, source: "manual" };
    }
  }

  if (Number.isFinite(query.latitude) && Number.isFinite(query.longitude)) {
    const reverse = await reverseGeocode(query.latitude, query.longitude).catch(() => ({}));
    return {
      latitude: query.latitude,
      longitude: query.longitude,
      city: reverse.city || "",
      district: reverse.district || "",
      source: "browser",
    };
  }

  const forwardedFor = String(request.header("x-forwarded-for") || "")
    .split(",")[0]
    .trim();
  const candidateIp = isPublicIp(forwardedFor) ? forwardedFor : "";
  if (candidateIp) {
    const ipData = await fetchJsonWithTimeout(`https://ipwho.is/${candidateIp}`, WEATHER_REQUEST_TIMEOUT_MS)
      .catch(() => null);
    if (ipData?.success && Number.isFinite(Number(ipData.latitude)) && Number.isFinite(Number(ipData.longitude))) {
      return {
        latitude: Number(ipData.latitude),
        longitude: Number(ipData.longitude),
        city: ipData.city || "",
        district: ipData.region || "",
        source: "header-ip",
      };
    }
  }

  return {
    latitude: 31.2304,
    longitude: 121.4737,
    city: "上海",
    district: "",
    source: "default",
  };
}

async function searchWeatherLocation(query) {
  const result = await fetchJsonWithTimeout(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=1&accept-language=zh-CN`,
    WEATHER_REQUEST_TIMEOUT_MS,
    {
      headers: {
        "User-Agent": "LifeFlow/1.0",
      },
    }
  ).catch(() => []);

  const first = Array.isArray(result) ? result[0] : null;
  if (!first) {
    return null;
  }

  const latitude = Number(first.lat);
  const longitude = Number(first.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const address = first.address || {};
  return {
    latitude,
    longitude,
    city:
      address.city ||
      address.town ||
      address.state_district ||
      address.state ||
      first.display_name?.split(",")[0] ||
      "",
    district:
      address.city_district ||
      address.suburb ||
      address.borough ||
      address.quarter ||
      address.county ||
      "",
  };
}

function isPublicIp(ip) {
  if (!ip) {
    return false;
  }
  if (ip === "::1" || ip === "127.0.0.1") {
    return false;
  }
  if (ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("172.16.")) {
    return false;
  }
  return true;
}

async function reverseGeocode(latitude, longitude) {
  const locationData = await fetchJsonWithTimeout(
    `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=jsonv2&accept-language=zh-CN`,
    WEATHER_REQUEST_TIMEOUT_MS,
    {
      headers: {
        "User-Agent": "LifeFlow/1.0",
      },
    }
  ).catch(() => ({}));
  const address = locationData.address || {};
  return {
    city:
      address.city ||
      address.town ||
      address.state_district ||
      address.state ||
      "",
    district:
      address.city_district ||
      address.suburb ||
      address.borough ||
      address.quarter ||
      address.county ||
      "",
  };
}

function formatLocationLabel(city, district) {
  const cityLabel = city || "当前城市";
  if (!district || district === cityLabel) {
    return cityLabel;
  }
  return `${cityLabel}, ${district}`;
}

function weatherCodeToText(code) {
  const map = {
    0: "晴朗",
    1: "大致晴",
    2: "局部多云",
    3: "阴天",
    45: "有雾",
    48: "冻雾",
    51: "小毛雨",
    61: "小雨",
    63: "中雨",
    65: "大雨",
    71: "小雪",
    80: "阵雨",
    95: "雷暴",
  };
  return map[code] || (typeof code === "number" ? `天气代码 ${code}` : "天气状态未知");
}

async function fetchJsonWithTimeout(url, timeoutMs, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await scryptAsync(password, salt);
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password, passwordHash) {
  const [salt, storedHash] = String(passwordHash || "").split(":");
  if (!salt || !storedHash) {
    return false;
  }
  const derivedKey = await scryptAsync(password, salt);
  const storedBuffer = Buffer.from(storedHash, "hex");
  return (
    storedBuffer.length === derivedKey.length &&
    crypto.timingSafeEqual(storedBuffer, derivedKey)
  );
}

function scryptAsync(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    });
  });
}

function normalizeDateParam(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateValue}`);
  }
  return formatDateKey(date);
}

module.exports = { createApp };
