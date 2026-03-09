const { createClient } = require("@supabase/supabase-js");
const { defaultTasks } = require("./memoryStore");

class SupabaseStore {
  constructor({ supabaseUrl, supabaseServiceRoleKey }) {
    this.client = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });
  }

  async init() {
    const { count, error } = await this.client
      .from("tasks")
      .select("id", { count: "exact", head: true });

    if (error) {
      throw error;
    }

    if (Number(count || 0) > 0) {
      return this;
    }

    const { error: seedError } = await this.client.from("tasks").upsert(defaultTasks, {
      onConflict: "id",
    });

    if (seedError) {
      throw seedError;
    }

    return this;
  }

  async listTasks() {
    const { data, error } = await this.client
      .from("tasks")
      .select("id, name, color, display_order, created_at")
      .order("display_order", { ascending: true });

    if (error) {
      throw error;
    }

    return data;
  }

  async createTask(task) {
    const { data, error } = await this.client
      .from("tasks")
      .insert(task)
      .select("id, name, color, display_order, created_at")
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async deleteTask(taskId) {
    const { error } = await this.client.from("tasks").delete().eq("id", taskId);
    if (error) {
      throw error;
    }
  }

  async getDailyRecord(date) {
    const { data, error } = await this.client
      .from("daily_records")
      .select("record_date, payload, updated_at")
      .eq("record_date", date)
      .maybeSingle();

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

  async upsertDailyRecord(date, payload) {
    const { data, error } = await this.client
      .from("daily_records")
      .upsert({
        record_date: date,
        payload,
        updated_at: new Date().toISOString(),
      })
      .select("record_date, payload, updated_at")
      .single();

    if (error) {
      throw error;
    }

    return {
      date: data.record_date,
      payload: data.payload,
      updatedAt: data.updated_at,
    };
  }

  async listDailyRecordsBetween(startDate, endDate) {
    const { data, error } = await this.client
      .from("daily_records")
      .select("record_date, payload, updated_at")
      .gte("record_date", startDate)
      .lte("record_date", endDate)
      .order("record_date", { ascending: true });

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
