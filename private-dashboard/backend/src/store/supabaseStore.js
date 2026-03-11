const { createClient } = require("@supabase/supabase-js");

class SupabaseStore {
  constructor({ supabaseUrl, supabaseServiceRoleKey }) {
    this.client = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });
    this.schemaMode = "user-scoped";
  }

  async init() {
    return this;
  }

  async listTasks(scope = {}) {
    const { data, error } = await this.client
      .from("tasks")
      .select("id, name, color, display_order, archived, archived_at, created_at")
      .eq("user_id", scope.userId || "")
      .order("display_order", { ascending: true });

    if (error) {
      throw error;
    }

    return data;
  }

  async createTask(scope = {}, task) {
    const { data, error } = await this.client
      .from("tasks")
      .insert({ ...task, user_id: scope.userId || "" })
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

    const { data, error } = await this.client
      .from("tasks")
      .update(updatePayload)
      .eq("user_id", scope.userId || "")
      .eq("id", taskId)
      .select("id, name, color, display_order, archived, archived_at, created_at")
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async deleteTask(scope = {}, taskId) {
    const { error } = await this.client
      .from("tasks")
      .delete()
      .eq("user_id", scope.userId || "")
      .eq("id", taskId);

    if (error) {
      throw error;
    }
  }

  async getDailyRecord(scope = {}, date) {
    const { data, error } = await this.client
      .from("daily_records")
      .select("record_date, payload, updated_at")
      .eq("user_id", scope.userId || "")
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

  async upsertDailyRecord(scope = {}, date, payload) {
    const { data, error } = await this.client
      .from("daily_records")
      .upsert(
        {
          user_id: scope.userId || "",
          record_date: date,
          payload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,record_date" }
      )
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

  async listDailyRecordsBetween(scope = {}, startDate, endDate) {
    const { data, error } = await this.client
      .from("daily_records")
      .select("record_date, payload, updated_at")
      .eq("user_id", scope.userId || "")
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

  async getWeeklySummary(scope = {}, week) {
    const { data, error } = await this.client
      .from("weekly_summaries")
      .select("week_key, content, updated_at")
      .eq("user_id", scope.userId || "")
      .eq("week_key", week)
      .maybeSingle();

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
    const { data, error } = await this.client
      .from("weekly_summaries")
      .upsert(
        {
          user_id: scope.userId || "",
          week_key: week,
          content: payload.content || "",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,week_key" }
      )
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

  async getUserById(userId) {
    const { data, error } = await this.client
      .from("users")
      .select("id, username, password_hash, created_at")
      .eq("id", userId)
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

  async updateUserPassword(userId, passwordHash) {
    const { data, error } = await this.client
      .from("users")
      .update({ password_hash: passwordHash })
      .eq("id", userId)
      .select("id, username, password_hash, created_at")
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  async getAccountProfile(userId) {
    const user = await this.getUserById(userId);
    if (!user) {
      return null;
    }

    const [
      { count: tasksCount, error: tasksError },
      { count: dailyCount, error: dailyError },
      { count: weeklyCount, error: weeklyError },
    ] = await Promise.all([
      this.client.from("tasks").select("*", { count: "exact", head: true }).eq("user_id", userId),
      this.client
        .from("daily_records")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId),
      this.client
        .from("weekly_summaries")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId),
    ]);

    if (tasksError || dailyError || weeklyError) {
      throw tasksError || dailyError || weeklyError;
    }

    return {
      user: {
        id: user.id,
        username: user.username,
        created_at: user.created_at,
      },
      counts: {
        tasks: tasksCount || 0,
        dailyRecords: dailyCount || 0,
        weeklySummaries: weeklyCount || 0,
      },
    };
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
      .select("id, user_id, expires_at, created_at, users!inner(id, username, password_hash, created_at)")
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
    const { error } = await this.client.from("user_sessions").delete().eq("id", sessionId);

    if (error) {
      throw error;
    }
  }

  async clearUserData(userId) {
    const [tasksResult, recordsResult, summariesResult] = await Promise.all([
      this.client.from("tasks").delete().eq("user_id", userId),
      this.client.from("daily_records").delete().eq("user_id", userId),
      this.client.from("weekly_summaries").delete().eq("user_id", userId),
    ]);

    if (tasksResult.error || recordsResult.error || summariesResult.error) {
      throw tasksResult.error || recordsResult.error || summariesResult.error;
    }
  }

  async deleteUserAccount(userId) {
    await this.clearUserData(userId);
    const { error } = await this.client.from("users").delete().eq("id", userId);
    if (error) {
      throw error;
    }
  }
}

module.exports = { SupabaseStore };
