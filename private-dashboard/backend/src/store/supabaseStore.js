const { createClient } = require("@supabase/supabase-js");
const { defaultTasks } = require("./memoryStore");

class SupabaseStore {
  constructor({ supabaseUrl, supabaseServiceRoleKey }) {
    this.client = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });
    this.schemaMode = "legacy";
  }

  async init() {
    this.schemaMode = await this.detectSchemaMode();
    await this.ensureDefaultTasks({ userId: "public" });
    return this;
  }

  async detectSchemaMode() {
    const { error } = await this.client.from("tasks").select("user_id").limit(1);
    return error ? "legacy" : "user-scoped";
  }

  async ensureDefaultTasks(scope = {}) {
    if (this.schemaMode === "legacy") {
      const { count, error } = await this.client
        .from("tasks")
        .select("id", { count: "exact", head: true });

      if (error) {
        throw error;
      }

      if (Number(count || 0) > 0) {
        return;
      }

      const { error: seedError } = await this.client.from("tasks").upsert(defaultTasks, {
        onConflict: "id",
      });

      if (seedError) {
        throw seedError;
      }

      return;
    }

    const userId = scope.userId || "public";
    const { count, error } = await this.client
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (error) {
      throw error;
    }

    if (Number(count || 0) > 0) {
      return;
    }

    const scopedDefaults = defaultTasks.map((task) => ({ ...task, user_id: userId }));
    const { error: seedError } = await this.client.from("tasks").upsert(scopedDefaults, {
      onConflict: "user_id,id",
    });

    if (seedError) {
      throw seedError;
    }
  }

  async listTasks(scope = {}) {
    await this.ensureDefaultTasks(scope);

    let query = this.client
      .from("tasks")
      .select("id, name, color, display_order, created_at")
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
      .select("id, name, color, display_order, created_at")
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
}

module.exports = { SupabaseStore };
