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

  async updateTask(scope = {}, taskId, patch) {
    let query = this.client
      .from("tasks")
      .update({
        name: patch.name,
        color: patch.color,
        display_order: patch.display_order,
      })
      .eq("id", taskId);

    if (this.schemaMode === "user-scoped") {
      query = query.eq("user_id", scope.userId || "public");
    }

    const { data, error } = await query
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
