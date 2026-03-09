const crypto = require("node:crypto");
const cors = require("cors");
const express = require("express");
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

  app.get("/health", async (request, response) => {
    response.json({
      ok: true,
      storage: config.useSupabase ? "supabase" : "memory",
      now: new Date().toISOString(),
    });
  });

  app.get("/api/tasks", async (request, response, next) => {
    try {
      const tasks = await store.listTasks();
      response.json({ tasks });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/tasks", requireWriteKey(config), async (request, response, next) => {
    try {
      const parsed = taskSchema.parse(request.body);
      const existingTasks = await store.listTasks();
      const task = {
        id: parsed.id || crypto.randomUUID(),
        name: parsed.name,
        color: parsed.color,
        display_order: parsed.displayOrder || existingTasks.length + 1,
      };
      const created = await store.createTask(task);
      response.status(201).json({ task: created });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/tasks/:taskId", requireWriteKey(config), async (request, response, next) => {
    try {
      await store.deleteTask(request.params.taskId);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/daily-records/:date", async (request, response, next) => {
    try {
      const date = normalizeDateParam(request.params.date);
      const record = await store.getDailyRecord(date);
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
      const record = await store.upsertDailyRecord(date, payload);
      response.json({ record });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/weekly-review/:week", async (request, response, next) => {
    try {
      const week = String(request.params.week);
      const range = getWeekRangeFromWeekValue(week);
      const tasks = await store.listTasks();
      const records = await store.listDailyRecordsBetween(
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

function normalizeDateParam(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateValue}`);
  }
  return formatDateKey(date);
}

module.exports = { createApp };
