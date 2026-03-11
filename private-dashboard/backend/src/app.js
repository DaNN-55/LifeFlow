const crypto = require("node:crypto");
const cors = require("cors");
const express = require("express");
const { z } = require("zod");
const { formatDateKey, getWeekRangeFromWeekValue } = require("./lib/date");

const SESSION_COOKIE_NAME = "lifeflow_session";
const SESSION_TTL_DAYS = 30;

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
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_\-.]+$/),
  password: z.string().min(6).max(128),
});

function createApp({ config, store }) {
  const app = express();

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
      userId: request.userContext?.userId || "public",
      authenticated: Boolean(request.userContext?.isAuthenticated),
      now: new Date().toISOString(),
    });
  });

  app.post("/api/auth/signup", async (request, response, next) => {
    try {
      const parsed = credentialsSchema.parse(request.body);
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
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/signin", async (request, response, next) => {
    try {
      const parsed = credentialsSchema.parse(request.body);
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
    });
  });

  app.get("/api/tasks", requireAuthenticated(config), async (request, response, next) => {
    try {
      const tasks = await store.listTasks(request.userContext);
      response.json({ tasks });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/tasks", requireAuthenticated(config), async (request, response, next) => {
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

  app.patch("/api/tasks/:taskId", requireAuthenticated(config), async (request, response, next) => {
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

  app.delete("/api/tasks/:taskId", requireAuthenticated(config), async (request, response, next) => {
    try {
      await store.deleteTask(request.userContext, request.params.taskId);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/daily-records/:date", requireAuthenticated(config), async (request, response, next) => {
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

  app.put("/api/daily-records/:date", requireAuthenticated(config), async (request, response, next) => {
    try {
      const date = normalizeDateParam(request.params.date);
      const payload = dailyRecordSchema.parse(request.body);
      const record = await store.upsertDailyRecord(request.userContext, date, payload);
      response.json({ record });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/weekly-review/:week", requireAuthenticated(config), async (request, response, next) => {
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

  app.get("/api/weekly-summaries/:week", requireAuthenticated(config), async (request, response, next) => {
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

  app.put("/api/weekly-summaries/:week", requireAuthenticated(config), async (request, response, next) => {
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

function requireAuthenticated(config) {
  return (request, response, next) => {
    if (request.userContext?.isAuthenticated) {
      next();
      return;
    }

    if (!config.writeKey) {
      response.status(401).json({ error: "Authentication required" });
      return;
    }

    const candidate = request.header("x-app-key");
    if (candidate !== config.writeKey) {
      response.status(401).json({ error: "Invalid x-app-key" });
      return;
    }

    next();
  };
}

async function resolveUserContext(request, store) {
  const sessionId = getSessionIdFromRequest(request);
  if (!sessionId) {
    return { userId: "", isAuthenticated: false, username: "" };
  }

  const result = await store.getSessionWithUser(sessionId);
  if (!result?.session || !result?.user) {
    return { userId: "", isAuthenticated: false, username: "" };
  }

  const expiresAt = new Date(result.session.expires_at);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
    await store.deleteSession(sessionId);
    return { userId: "", isAuthenticated: false, username: "" };
  }

  return {
    userId: result.user.id,
    isAuthenticated: true,
    username: result.user.username || "",
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
