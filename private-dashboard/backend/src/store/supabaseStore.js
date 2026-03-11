const { createClient } = require("@supabase/supabase-js");

class SupabaseStore {
  constructor({ supabaseUrl, supabaseServiceRoleKey }) {
    this.client = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });
    this.schemaMode = "legacy";
  }

  async init() {
    this.schemaMode = await this.detectSchemaMode();
    return this;
  }

  async detectSchemaMode() {
    const { error } = await this.client.from("tasks").select("user_id").limit(1);
    return error ? "legacy" : "user-scoped";
  }

  async listTasks(scope = {}) {
    let query = this.client
      .from("tasks")
      .select("id, name, color, display_order, archived, archived_at, created_at")
      .order("display_order", { ascending: true });

    if (this.schemaMode === "user-scoped") {
      query = query.eq("user_id", scope.userId || "public");
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data;
  }

  async createTask(scope = {}, task) {
    const payload =
      this.schemaMode === "user-scoped" ? { ...task, user_id: scope.userId || "public" } : task;
    const { data, error } = await this.client
      .from("tasks")
      .insert(payload)
      .select("id, name, color, display_order, archived, archived_at, created_at")
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async updateTask(scope = {}, taskId, patch) {
    const updatePayload = {};
    if (typeof patch.name !== "undefined") {
      updatePayload.name = patch.name;
    }
    if (typeof patch.color !== "undefined") {
      updatePayload.color = patch.color;
    }
    if (typeof patch.display_order !== "undefined") {
      updatePayload.display_order = patch.display_order;
    }
    if (typeof patch.archived !== "undefined") {
      updatePayload.archived = patch.archived;
    }
    if (typeof patch.archived_at !== "undefined") {
      updatePayload.archived_at = patch.archived_at;
    }

    let query = this.client
      .from("tasks")
      .update(updatePayload)
      .eq("id", taskId);

    if (this.schemaMode === "user-scoped") {
      query = query.eq("user_id", scope.userId || "public");
    }

    const { data, error } = await query
      .select("id, name, color, display_order, archived, archived_at, created_at")
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async deleteTask(scope = {}, taskId) {
    let query = this.client.from("tasks").delete().eq("id", taskId);
    if (this.schemaMode === "user-scoped") {
      query = query.eq("user_id", scope.userId || "public");
    }
    const { error } = await query;
    if (error) {
      throw error;
    }
  }

  async getDailyRecord(scope = {}, date) {
    let query = this.client
      .from("daily_records")
      .select("record_date, payload, updated_at")
      .eq("record_date", date);

    if (this.schemaMode === "user-scoped") {
      query = query.eq("user_id", scope.userId || "public");
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    return {
      date: data.record_date,
      payload: data.payload,
      updatedAt: data.updated_at,
    };
  }

  async upsertDailyRecord(scope = {}, date, payload) {
    const recordPayload =
      this.schemaMode === "user-scoped"
        ? {
            user_id: scope.userId || "public",
            record_date: date,
            payload,
            updated_at: new Date().toISOString(),
          }
        : {
            record_date: date,
            payload,
            updated_at: new Date().toISOString(),
          };

    const query = this.client.from("daily_records").upsert(recordPayload, {
      onConflict: this.schemaMode === "user-scoped" ? "user_id,record_date" : "record_date",
    });

    const { data, error } = await query.select("record_date, payload, updated_at").single();

    if (error) {
      throw error;
    }

    return {
      date: data.record_date,
      payload: data.payload,
      updatedAt: data.updated_at,
    };
  }

  async listDailyRecordsBetween(scope = {}, startDate, endDate) {
    let query = this.client
      .from("daily_records")
      .select("record_date, payload, updated_at")
      .gte("record_date", startDate)
      .lte("record_date", endDate)
      .order("record_date", { ascending: true });

    if (this.schemaMode === "user-scoped") {
      query = query.eq("user_id", scope.userId || "public");
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data.map((record) => ({
      date: record.record_date,
      payload: record.payload,
      updatedAt: record.updated_at,
    }));
  }

  async getWeeklySummary(scope = {}, week) {
    let query = this.client
      .from("weekly_summaries")
      .select("week_key, content, updated_at")
      .eq("week_key", week);

    if (this.schemaMode === "user-scoped") {
      query = query.eq("user_id", scope.userId || "public");
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      throw error;
    }
    if (!data) {
      return null;
    }
    return {
      week: data.week_key,
      content: data.content || "",
      updatedAt: data.updated_at,
    };
  }

  async upsertWeeklySummary(scope = {}, week, payload) {
    const summaryPayload =
      this.schemaMode === "user-scoped"
        ? {
            user_id: scope.userId || "public",
            week_key: week,
            content: payload.content || "",
            updated_at: new Date().toISOString(),
          }
        : {
            week_key: week,
            content: payload.content || "",
            updated_at: new Date().toISOString(),
          };

    const { data, error } = await this.client
      .from("weekly_summaries")
      .upsert(summaryPayload, {
        onConflict: this.schemaMode === "user-scoped" ? "user_id,week_key" : "week_key",
      })
      .select("week_key, content, updated_at")
      .single();

    if (error) {
      throw error;
    }

    return {
      week: data.week_key,
      content: data.content || "",
      updatedAt: data.updated_at,
    };
  }

  async findUserByUsername(username) {
    const { data, error } = await this.client
      .from("users")
      .select("id, username, password_hash, created_at")
      .eq("username", username)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  async createUser(user) {
    const { data, error } = await this.client
      .from("users")
      .insert(user)
      .select("id, username, password_hash, created_at")
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async createSession(session) {
    const { data, error } = await this.client
      .from("user_sessions")
      .insert(session)
      .select("id, user_id, expires_at, created_at")
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async getSessionWithUser(sessionId) {
    const { data, error } = await this.client
      .from("user_sessions")
      .select(
        "id, user_id, expires_at, created_at, users!inner(id, username, password_hash, created_at)",
      )
      .eq("id", sessionId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    return {
      session: {
        id: data.id,
        user_id: data.user_id,
        expires_at: data.expires_at,
        created_at: data.created_at,
      },
      user: Array.isArray(data.users) ? data.users[0] : data.users,
    };
  }

  async deleteSession(sessionId) {
    const { error } = await this.client
      .from("user_sessions")
      .delete()
      .eq("id", sessionId);

    if (error) {
      throw error;
    }
  }
}

module.exports = { SupabaseStore };
