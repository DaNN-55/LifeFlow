const crypto = require("node:crypto");
const cors = require("cors");
const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const { z } = require("zod");
const { formatDateKey, getWeekRangeFromWeekValue } = require("./lib/date");

const taskSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  name: z.string().min(1).max(40),
  color: z.string().min(1).max(64),
  displayOrder: z.number().int().positive().optional(),
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

function createApp({ config, store }) {
  const app = express();
  const adminClient = config.useSupabase
    ? createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
        auth: { persistSession: false },
      })
    : null;

  app.use(
    cors({
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
      request.userContext = await resolveUserContext(request, adminClient);
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

  app.get("/api/tasks", async (request, response, next) => {
    try {
      const tasks = await store.listTasks(request.userContext);
      response.json({ tasks });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/tasks", requireWriteKey(config), async (request, response, next) => {
    try {
      const parsed = taskSchema.parse(request.body);
      const existingTasks = await store.listTasks(request.userContext);
      const task = {
        id: parsed.id || crypto.randomUUID(),
        name: parsed.name,
        color: parsed.color,
        display_order: parsed.displayOrder || existingTasks.length + 1,
      };
      const created = await store.createTask(request.userContext, task);
      response.status(201).json({ task: created });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/tasks/:taskId", requireWriteKey(config), async (request, response, next) => {
    try {
      const parsed = taskSchema.partial().parse(request.body);
      const updated = await store.updateTask(request.userContext, request.params.taskId, {
        name: parsed.name,
        color: parsed.color,
        display_order: parsed.displayOrder,
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

  app.delete("/api/tasks/:taskId", requireWriteKey(config), async (request, response, next) => {
    try {
      await store.deleteTask(request.userContext, request.params.taskId);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/daily-records/:date", async (request, response, next) => {
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

  app.put("/api/daily-records/:date", requireWriteKey(config), async (request, response, next) => {
    try {
      const date = normalizeDateParam(request.params.date);
      const payload = dailyRecordSchema.parse(request.body);
      const record = await store.upsertDailyRecord(request.userContext, date, payload);
      response.json({ record });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/weekly-review/:week", async (request, response, next) => {
    try {
      const week = String(request.params.week);
      const range = getWeekRangeFromWeekValue(week);
      const tasks = await store.listTasks(request.userContext);
      const records = await store.listDailyRecordsBetween(
        request.userContext,
        formatDateKey(range.start),
        formatDateKey(range.end)
      );

      const completionCounts = {};
      const notesByTask = {};

      tasks.forEach((task) => {
        completionCounts[task.id] = 0;
        notesByTask[task.id] = [];
      });

      records.forEach((record) => {
        tasks.forEach((task) => {
          const taskState = record.payload?.tasks?.[task.id];
          if (!taskState) {
            return;
          }
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
        completionCounts,
        notesByTask,
      });
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

function requireWriteKey(config) {
  return (request, response, next) => {
    if (!config.writeKey) {
      next();
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

async function resolveUserContext(request, adminClient) {
  const authHeader = request.header("authorization") || "";
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!tokenMatch) {
    return { userId: "public", isAuthenticated: false, email: "" };
  }

  if (!adminClient) {
    return { userId: "public", isAuthenticated: false, email: "" };
  }

  const accessToken = tokenMatch[1];
  const { data, error } = await adminClient.auth.getUser(accessToken);
  if (error || !data?.user) {
    const authError = new Error("Invalid bearer token");
    authError.statusCode = 401;
    throw authError;
  }

  return {
    userId: data.user.id,
    isAuthenticated: true,
    email: data.user.email || "",
  };
}

function normalizeDateParam(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateValue}`);
  }
  return formatDateKey(date);
}

module.exports = { createApp };
