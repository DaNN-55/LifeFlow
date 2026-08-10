const { createClient } = require("@supabase/supabase-js");

const USER_SELECT_FIELDS = "id, username, password_hash, recovery_code_hash, preferences, created_at, data_updated_at, data_reset_at";
const CONTENT_SOURCE_SELECT_FIELDS = [
  "id",
  "channel",
  "type",
  "name",
  "url",
  "enabled",
  "sort_order",
  "parser_key",
  "last_synced_at",
  "last_success_at",
  "last_failure_at",
  "last_error",
  "latest_published_at",
  "created_at",
  "updated_at",
].join(", ");
const CONTENT_ITEM_LIST_SELECT_FIELDS = [
  "id",
  "channel",
  "source_id",
  "title",
  "summary_zh",
  "summary_raw",
  "author",
  "published_at",
  "content_type",
  "source_name",
  "source_url",
  "canonical_url",
  "tags",
  "lang",
  "image_url",
  "is_featured",
  "fetched_at",
  "created_at",
  "updated_at",
].join(", ");
const CONTENT_ITEM_FULL_SELECT_FIELDS = [
  "id",
  "channel",
  "source_id",
  "title",
  "summary_zh",
  "summary_raw",
  "body_zh",
  "body_raw",
  "author",
  "published_at",
  "content_type",
  "source_name",
  "source_url",
  "canonical_url",
  "tags",
  "lang",
  "image_url",
  "is_featured",
  "fetched_at",
  "created_at",
  "updated_at",
].join(", ");

function normalizeContentSourceIdentity(source = {}) {
  return {
    channel: String(source.channel || "").trim(),
    type: String(source.type || "").trim(),
    url: String(source.url || "").trim(),
    parser_key: String(source.parser_key || "").trim(),
  };
}

function isUniqueViolation(error) {
  return String(error?.code || "").trim() === "23505";
}

function normalizePrimaryTag(tag) {
  const cleaned = String(tag || "").replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return "";
  }
  const [primary] = cleaned.split(/\s*\/\s*|\s*>\s*|\s*::\s*/);
  return String(primary || "").replace(/\s+/g, " ").trim();
}

function normalizeTagList(tags = []) {
  const values = Array.isArray(tags) ? tags : [tags];
  return [...new Set(values.map((tag) => normalizePrimaryTag(tag)).filter(Boolean))].slice(0, 8);
}

function itemHasPrimaryTag(item, tag) {
  const normalizedTag = normalizePrimaryTag(tag);
  if (!normalizedTag) {
    return true;
  }
  return normalizeTagList(item?.tags || []).includes(normalizedTag);
}

function normalizeContentItem(item = {}) {
  return {
    ...item,
    tags: normalizeTagList(item.tags || []),
  };
}

function formatSupabaseErrorText(error) {
  return [error?.message, error?.details, error?.hint]
    .filter((value) => typeof value === "string" && value.trim())
    .join(" | ");
}

function buildTableAvailabilityError(tableName, error) {
  const code = String(error?.code || "").trim().toUpperCase();
  const status = Number(error?.status || 0);
  const errorText = formatSupabaseErrorText(error);

  if (
    code === "42P01" ||
    code === "PGRST205" ||
    /relation .* does not exist|schema cache|could not find the table/i.test(errorText)
  ) {
    return new Error(`Supabase 表 ${tableName} 不可用，请先执行最新 migration`);
  }

  if (
    status === 401 ||
    status === 403 ||
    /invalid api key|invalid jwt|jwt|permission denied|not authorized|forbidden/i.test(errorText)
  ) {
    return new Error(
      `Supabase 表 ${tableName} 检查失败，请确认 SUPABASE_SERVICE_ROLE_KEY 正确且具备访问权限`
    );
  }

  if (
    /fetch failed|network|econn|enotfound|etimedout|tls connection/i.test(errorText)
  ) {
    return new Error(
      `Supabase 表 ${tableName} 检查失败，当前无法连接到 Supabase，请确认 SUPABASE_URL、网络和目标服务状态`
    );
  }

  const detail = errorText || "未知错误";
  return new Error(`Supabase 表 ${tableName} 检查失败: ${detail}`);
}

async function fetchAllRows(query, batchSize = 1000) {
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await query.range(from, from + batchSize - 1);
    if (error) {
      throw error;
    }
    const chunk = Array.isArray(data) ? data : [];
    rows.push(...chunk);
    if (chunk.length < batchSize) {
      return rows;
    }
    from += batchSize;
  }
}

class SupabaseStore {
  constructor({ supabaseUrl, supabaseServiceRoleKey }) {
    this.client = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });
    this.schemaMode = "user-scoped";
  }

  async init() {
    await Promise.all([
      this.assertTableAvailable("users"),
      this.assertTableAvailable("content_sources"),
      this.assertTableAvailable("content_items"),
      this.assertTableAvailable("content_favorites"),
    ]);
    return this;
  }

  async assertTableAvailable(tableName) {
    const { error } = await this.client.from(tableName).select("*", { head: true, count: "exact" }).limit(1);
    if (!error) {
      return;
    }
    const nextError = buildTableAvailabilityError(tableName, error);
    nextError.cause = error;
    throw nextError;
  }

  async touchUserSyncState(userId, options = {}) {
    const payload = {
      data_updated_at: new Date().toISOString(),
    };

    if (options.reset) {
      payload.data_reset_at = payload.data_updated_at;
    }

    const { error } = await this.client
      .from("users")
      .update(payload)
      .eq("id", userId);

    if (error) {
      throw error;
    }
  }

  async listTasks(scope = {}) {
    const { data, error } = await this.client
      .from("tasks")
      .select("id, name, color, display_order, archived, archived_at, created_at, updated_at")
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
      .insert({ ...task, user_id: scope.userId || "", updated_at: new Date().toISOString() })
      .select("id, name, color, display_order, archived, archived_at, created_at, updated_at")
      .single();

    if (error) {
      throw error;
    }

    await this.touchUserSyncState(scope.userId);
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
    updatePayload.updated_at = new Date().toISOString();

    const { data, error } = await this.client
      .from("tasks")
      .update(updatePayload)
      .eq("user_id", scope.userId || "")
      .eq("id", taskId)
      .select("id, name, color, display_order, archived, archived_at, created_at, updated_at")
      .single();

    if (error) {
      throw error;
    }

    await this.touchUserSyncState(scope.userId);
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

    await this.touchUserSyncState(scope.userId, { reset: true });
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

    await this.touchUserSyncState(scope.userId);
    return {
      date: data.record_date,
      payload: data.payload,
      updatedAt: data.updated_at,
    };
  }

  async listDailyRecords(scope = {}) {
    const { data, error } = await this.client
      .from("daily_records")
      .select("record_date, payload, updated_at")
      .eq("user_id", scope.userId || "")
      .order("record_date", { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []).map((record) => ({
      date: record.record_date,
      payload: record.payload,
      updatedAt: record.updated_at,
    }));
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

    await this.touchUserSyncState(scope.userId);
    return {
      week: data.week_key,
      content: data.content || "",
      updatedAt: data.updated_at,
    };
  }

  async listWeeklySummaries(scope = {}) {
    const { data, error } = await this.client
      .from("weekly_summaries")
      .select("week_key, content, updated_at")
      .eq("user_id", scope.userId || "")
      .order("week_key", { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []).map((summary) => ({
      week: summary.week_key,
      content: summary.content || "",
      updatedAt: summary.updated_at,
    }));
  }

  async listTasksUpdatedSince(scope = {}, since) {
    const { data, error } = await this.client
      .from("tasks")
      .select("id, name, color, display_order, archived, archived_at, created_at, updated_at")
      .eq("user_id", scope.userId || "")
      .gt("updated_at", since)
      .order("display_order", { ascending: true });

    if (error) {
      throw error;
    }

    return data || [];
  }

  async listDailyRecordsUpdatedSince(scope = {}, since) {
    const { data, error } = await this.client
      .from("daily_records")
      .select("record_date, payload, updated_at")
      .eq("user_id", scope.userId || "")
      .gt("updated_at", since)
      .order("record_date", { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []).map((record) => ({
      date: record.record_date,
      payload: record.payload,
      updatedAt: record.updated_at,
    }));
  }

  async listWeeklySummariesUpdatedSince(scope = {}, since) {
    const { data, error } = await this.client
      .from("weekly_summaries")
      .select("week_key, content, updated_at")
      .eq("user_id", scope.userId || "")
      .gt("updated_at", since)
      .order("week_key", { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []).map((summary) => ({
      week: summary.week_key,
      content: summary.content || "",
      updatedAt: summary.updated_at,
    }));
  }

  async findUserByUsername(username) {
    const { data, error } = await this.client
      .from("users")
      .select(USER_SELECT_FIELDS)
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
      .select(USER_SELECT_FIELDS)
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
      .select(USER_SELECT_FIELDS)
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
      .select(USER_SELECT_FIELDS)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  async updateUserPreferences(userId, preferences) {
    const { data, error } = await this.client
      .from("users")
      .update({ preferences: preferences && typeof preferences === "object" ? preferences : {} })
      .eq("id", userId)
      .select(USER_SELECT_FIELDS)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  async updateUserUsername(userId, username) {
    const { data, error } = await this.client
      .from("users")
      .update({ username })
      .eq("id", userId)
      .select(USER_SELECT_FIELDS)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  async updateUserRecoveryCode(userId, recoveryCodeHash) {
    const { data, error } = await this.client
      .from("users")
      .update({ recovery_code_hash: recoveryCodeHash })
      .eq("id", userId)
      .select(USER_SELECT_FIELDS)
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
        preferences: user.preferences || {},
        created_at: user.created_at,
        data_updated_at: user.data_updated_at || "",
        data_reset_at: user.data_reset_at || "",
      },
      counts: {
        tasks: tasksCount || 0,
        dailyRecords: dailyCount || 0,
        weeklySummaries: weeklyCount || 0,
      },
    };
  }

  async listUsers() {
    const { data, error } = await this.client
      .from("users")
      .select("id, username, created_at, data_updated_at, data_reset_at");

    if (error) {
      throw error;
    }

    return data;
  }

  async listContentSources(scope = {}, channel = "") {
    let query = this.client
      .from("content_sources")
      .select(CONTENT_SOURCE_SELECT_FIELDS)
      .eq("user_id", scope.userId || "")
      .order("sort_order", { ascending: true });

    if (channel) {
      query = query.eq("channel", channel);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }
    return data;
  }

  async getContentSource(scope = {}, sourceId) {
    const { data, error } = await this.client
      .from("content_sources")
      .select(CONTENT_SOURCE_SELECT_FIELDS)
      .eq("user_id", scope.userId || "")
      .eq("id", sourceId)
      .maybeSingle();

    if (error) {
      throw error;
    }
    return data;
  }

  async findContentSourceByIdentity(scope = {}, identity = {}) {
    const { data, error } = await this.client
      .from("content_sources")
      .select(CONTENT_SOURCE_SELECT_FIELDS)
      .eq("user_id", scope.userId || "")
      .eq("channel", String(identity.channel || "").trim())
      .eq("type", String(identity.type || "").trim())
      .eq("url", String(identity.url || "").trim())
      .eq("parser_key", String(identity.parser_key || "").trim())
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }
    return data;
  }

  async createContentSource(scope = {}, source) {
    const identity = normalizeContentSourceIdentity(source);
    const existingSource = await this.findContentSourceByIdentity(scope, identity);
    if (existingSource) {
      return existingSource;
    }

    const { data, error } = await this.client
      .from("content_sources")
      .insert({ ...source, user_id: scope.userId || "" })
      .select(CONTENT_SOURCE_SELECT_FIELDS)
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        return this.findContentSourceByIdentity(scope, identity);
      }
      throw error;
    }
    await this.touchUserSyncState(scope.userId);
    return data;
  }

  async updateContentSource(scope = {}, sourceId, patch) {
    const { data, error } = await this.client
      .from("content_sources")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("user_id", scope.userId || "")
      .eq("id", sourceId)
      .select(CONTENT_SOURCE_SELECT_FIELDS)
      .maybeSingle();

    if (error) {
      throw error;
    }
    await this.touchUserSyncState(scope.userId);
    return data;
  }

  async updateContentSourceSync(scope = {}, sourceId, patch = {}) {
    const syncPatch = {};
    [
      "last_synced_at",
      "last_success_at",
      "last_failure_at",
      "last_error",
      "latest_published_at",
    ].forEach((key) => {
      if (typeof patch[key] !== "undefined") {
        syncPatch[key] = patch[key];
      }
    });

    const { data, error } = await this.client
      .from("content_sources")
      .update({ ...syncPatch, updated_at: new Date().toISOString() })
      .eq("user_id", scope.userId || "")
      .eq("id", sourceId)
      .select(CONTENT_SOURCE_SELECT_FIELDS)
      .maybeSingle();

    if (error) {
      throw error;
    }
    return data;
  }

  async listContentSourcesUpdatedSince(scope = {}, since) {
    let query = this.client
      .from("content_sources")
      .select(CONTENT_SOURCE_SELECT_FIELDS)
      .eq("user_id", scope.userId || "")
      .order("updated_at", { ascending: false });
    if (!Number.isNaN(new Date(since).getTime())) {
      query = query.gt("updated_at", since);
    }
    const { data, error } = await query;
    if (error) {
      throw error;
    }
    return data || [];
  }

  async deleteContentSource(scope = {}, sourceId) {
    const targetSource = await this.getContentSource(scope, sourceId);
    if (!targetSource) {
      return;
    }

    const identity = normalizeContentSourceIdentity(targetSource);
    const { data: duplicateSources, error: duplicateError } = await this.client
      .from("content_sources")
      .select("id")
      .eq("user_id", scope.userId || "")
      .eq("channel", identity.channel)
      .eq("type", identity.type)
      .eq("url", identity.url)
      .eq("parser_key", identity.parser_key);

    if (duplicateError) {
      throw duplicateError;
    }

    const sourceIds = [...new Set((duplicateSources || []).map((item) => item.id).filter(Boolean))];
    if (!sourceIds.length) {
      return;
    }

    const { error: itemError } = await this.client
      .from("content_items")
      .delete()
      .eq("user_id", scope.userId || "")
      .in("source_id", sourceIds);

    if (itemError) {
      throw itemError;
    }

    const { error } = await this.client
      .from("content_sources")
      .delete()
      .eq("user_id", scope.userId || "")
      .in("id", sourceIds);

    if (error) {
      throw error;
    }
    await this.touchUserSyncState(scope.userId, { reset: true });
  }

  async upsertContentItems(scope = {}, items = []) {
    if (!items.length) {
      return [];
    }
    const payload = items.map((item) => ({
      ...normalizeContentItem(item),
      user_id: scope.userId || "",
    }));
    const { data, error } = await this.client
      .from("content_items")
      .upsert(payload, { onConflict: "user_id,channel,canonical_url" })
      .select(CONTENT_ITEM_FULL_SELECT_FIELDS);

    if (error) {
      throw error;
    }
    return (data || []).map((item) => normalizeContentItem(item));
  }

  async replaceContentItems(scope = {}, channel = "", items = []) {
    let deleteQuery = this.client
      .from("content_items")
      .delete()
      .eq("user_id", scope.userId || "");
    if (channel) {
      deleteQuery = deleteQuery.eq("channel", channel);
    }
    const { error } = await deleteQuery;
    if (error) {
      throw error;
    }
    return this.upsertContentItems(scope, items);
  }

  async pruneExpiredContentItems(scope = {}, options = {}) {
    const cutoffIso = String(options.cutoffIso || "").trim();
    const channel = String(options.channel || "").trim();
    if (!cutoffIso || Number.isNaN(new Date(cutoffIso).getTime())) {
      return 0;
    }

    let query = this.client
      .from("content_items")
      .select("id")
      .eq("user_id", scope.userId || "")
      .lt("published_at", cutoffIso);

    if (channel) {
      query = query.eq("channel", channel);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    const staleIds = (data || []).map((item) => item.id).filter(Boolean);
    if (!staleIds.length) {
      return 0;
    }

    const { error: deleteError } = await this.client
      .from("content_items")
      .delete()
      .eq("user_id", scope.userId || "")
      .in("id", staleIds);

    if (deleteError) {
      throw deleteError;
    }

    await this.touchUserSyncState(scope.userId, { reset: true });
    return staleIds.length;
  }

  async listContentUpdatedSince(scope = {}, since, channel = "") {
    let query = this.client
      .from("content_items")
      .select(CONTENT_ITEM_LIST_SELECT_FIELDS)
      .eq("user_id", scope.userId || "")
      .order("updated_at", { ascending: false });
    if (channel) {
      query = query.eq("channel", channel);
    }
    if (!Number.isNaN(new Date(since).getTime())) {
      query = query.gt("updated_at", since);
    }
    const { data, error } = await query;
    if (error) {
      throw error;
    }
    return (data || []).map((item) => normalizeContentItem(item));
  }

  async listContent(scope = {}, filters = {}) {
    const page = Math.max(1, Number(filters.page || 1));
    const pageSize = Math.max(1, Number(filters.pageSize || 20));
    const requiresClientTagFilter = Boolean(filters.tag);
    let query = this.client
      .from("content_items")
      .select(CONTENT_ITEM_LIST_SELECT_FIELDS, { count: "exact" })
      .eq("user_id", scope.userId || "");

    if (filters.channel) {
      query = query.eq("channel", filters.channel);
    }
    if (filters.sourceId) {
      query = query.eq("source_id", filters.sourceId);
    }
    if (filters.q) {
      const escaped = String(filters.q).replace(/[%_,]/g, " ").trim();
      query = query.or(
        `title.ilike.%${escaped}%,summary_zh.ilike.%${escaped}%,summary_raw.ilike.%${escaped}%,source_name.ilike.%${escaped}%`,
      );
    }

    query = query.order("published_at", { ascending: filters.sort === "oldest" });
    if (!requiresClientTagFilter) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, count, error } = await query.range(from, to);

      if (error) {
        throw error;
      }
      return {
        items: (data || []).map((item) => normalizeContentItem(item)),
        total: count || 0,
        page,
        pageSize,
      };
    }

    const normalizedItems = (await fetchAllRows(query)).map((item) => normalizeContentItem(item));
    const filteredItems = normalizedItems.filter((item) => itemHasPrimaryTag(item, filters.tag));
    const total = filteredItems.length;
    const from = (page - 1) * pageSize;
    const to = from + pageSize;
    return {
      items: filteredItems.slice(from, to),
      total,
      page,
      pageSize,
    };
  }

  async listContentFacets(scope = {}, channel = "") {
    let itemsQuery = this.client
      .from("content_items")
      .select("tags, source_id")
      .eq("user_id", scope.userId || "");
    let sourcesQuery = this.client
      .from("content_sources")
      .select("id, name")
      .eq("user_id", scope.userId || "")
      .order("sort_order", { ascending: true });
    if (channel) {
      itemsQuery = itemsQuery.eq("channel", channel);
      sourcesQuery = sourcesQuery.eq("channel", channel);
    }
    const [{ data: items, error: itemsError }, { data: sources, error: sourcesError }] =
      await Promise.all([itemsQuery, sourcesQuery]);
    if (itemsError || sourcesError) {
      throw itemsError || sourcesError;
    }
    const tags = [...new Set((items || []).flatMap((item) => normalizeTagList(item.tags || [])))].sort();
    return { tags, sources: sources || [] };
  }

  async getFeaturedContent(scope = {}, channel = "", limit = 3) {
    const { data, error } = await this.client
      .from("content_items")
      .select(CONTENT_ITEM_LIST_SELECT_FIELDS)
      .eq("user_id", scope.userId || "")
      .eq("channel", channel)
      .order("is_featured", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }
    return (data || []).map((item) => normalizeContentItem(item));
  }

  async getContentItem(scope = {}, itemId) {
    const { data, error } = await this.client
      .from("content_items")
      .select(CONTENT_ITEM_FULL_SELECT_FIELDS)
      .eq("user_id", scope.userId || "")
      .eq("id", itemId)
      .maybeSingle();

    if (error) {
      throw error;
    }
    return data ? normalizeContentItem(data) : data;
  }

  async listFavoriteContent(scope = {}, filters = {}) {
    const page = Math.max(1, Number(filters.page || 1));
    const pageSize = Math.max(1, Number(filters.pageSize || 20));
    const requiresClientTagFilter = Boolean(filters.tag);
    let query = this.client
      .from("content_favorites")
      .select(
        "id, channel, source_id, title, summary_zh, summary_raw, author, published_at, content_type, source_name, source_url, canonical_url, tags, lang, image_url, favorited_at, created_at, updated_at",
        { count: "exact" },
      )
      .eq("user_id", scope.userId || "");

    if (filters.channel) {
      query = query.eq("channel", filters.channel);
    }
    if (filters.sourceId) {
      query = query.eq("source_id", filters.sourceId);
    }
    if (filters.q) {
      const escaped = String(filters.q).replace(/[%_,]/g, " ").trim();
      query = query.or(
        `title.ilike.%${escaped}%,summary_zh.ilike.%${escaped}%,summary_raw.ilike.%${escaped}%,source_name.ilike.%${escaped}%`,
      );
    }

    query = query.order("published_at", { ascending: filters.sort === "oldest" });
    if (!requiresClientTagFilter) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, count, error } = await query.range(from, to);
      if (error) {
        throw error;
      }
      return {
        items: (data || []).map((item) => ({ ...normalizeContentItem(item), is_favorite: true })),
        total: count || 0,
        page,
        pageSize,
      };
    }
    const normalizedItems = (await fetchAllRows(query)).map((item) => normalizeContentItem(item));
    const filteredItems = normalizedItems.filter((item) => itemHasPrimaryTag(item, filters.tag));
    const total = filteredItems.length;
    const from = (page - 1) * pageSize;
    const to = from + pageSize;
    return {
      items: filteredItems.slice(from, to).map((item) => ({ ...item, is_favorite: true })),
      total,
      page,
      pageSize,
    };
  }

  async listFavoriteContentUpdatedSince(scope = {}, since, channel = "") {
    let query = this.client
      .from("content_favorites")
      .select("id, channel, source_id, title, summary_zh, summary_raw, author, published_at, content_type, source_name, source_url, canonical_url, tags, lang, image_url, favorited_at, created_at, updated_at")
      .eq("user_id", scope.userId || "")
      .order("updated_at", { ascending: false });
    if (channel) {
      query = query.eq("channel", channel);
    }
    if (!Number.isNaN(new Date(since).getTime())) {
      query = query.gt("updated_at", since);
    }
    const { data, error } = await query;
    if (error) {
      throw error;
    }
    return (data || []).map((item) => ({ ...normalizeContentItem(item), is_favorite: true }));
  }

  async listFavoriteContentFacets(scope = {}, channel = "") {
    let itemsQuery = this.client
      .from("content_favorites")
      .select("tags, source_id")
      .eq("user_id", scope.userId || "");
    let sourcesQuery = this.client
      .from("content_sources")
      .select("id, name")
      .eq("user_id", scope.userId || "")
      .order("sort_order", { ascending: true });
    if (channel) {
      itemsQuery = itemsQuery.eq("channel", channel);
      sourcesQuery = sourcesQuery.eq("channel", channel);
    }
    const [{ data: items, error: itemsError }, { data: sources, error: sourcesError }] =
      await Promise.all([itemsQuery, sourcesQuery]);
    if (itemsError || sourcesError) {
      throw itemsError || sourcesError;
    }
    const tags = [...new Set((items || []).flatMap((item) => normalizeTagList(item.tags || [])))].sort();
    const sourceIds = new Set((items || []).map((item) => item.source_id).filter(Boolean));
    return {
      tags,
      sources: (sources || []).filter((source) => sourceIds.size === 0 || sourceIds.has(source.id)),
    };
  }

  async listFavoriteContentUrls(scope = {}, channel = "") {
    let query = this.client
      .from("content_favorites")
      .select("canonical_url")
      .eq("user_id", scope.userId || "");
    if (channel) {
      query = query.eq("channel", channel);
    }
    const { data, error } = await query;
    if (error) {
      throw error;
    }
    return (data || []).map((item) => item.canonical_url).filter(Boolean);
  }

  async getFavoriteContentItem(scope = {}, itemId) {
    const { data, error } = await this.client
      .from("content_favorites")
      .select("id, channel, source_id, title, summary_zh, summary_raw, body_zh, body_raw, author, published_at, content_type, source_name, source_url, canonical_url, tags, lang, image_url, favorited_at, created_at, updated_at")
      .eq("user_id", scope.userId || "")
      .eq("id", itemId)
      .maybeSingle();

    if (error) {
      throw error;
    }
    await this.touchUserSyncState(scope.userId);
    return data ? { ...normalizeContentItem(data), is_favorite: true } : null;
  }

  async upsertFavoriteContent(scope = {}, item) {
    const payload = {
      ...normalizeContentItem(item),
      user_id: scope.userId || "",
      favorited_at: item.favorited_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await this.client
      .from("content_favorites")
      .upsert(payload, { onConflict: "user_id,channel,canonical_url" })
      .select("id, channel, source_id, title, summary_zh, summary_raw, body_zh, body_raw, author, published_at, content_type, source_name, source_url, canonical_url, tags, lang, image_url, favorited_at, created_at, updated_at")
      .maybeSingle();

    if (error) {
      throw error;
    }
    return data ? { ...normalizeContentItem(data), is_favorite: true } : null;
  }

  async deleteFavoriteContent(scope = {}, channel, canonicalUrl) {
    const { error } = await this.client
      .from("content_favorites")
      .delete()
      .eq("user_id", scope.userId || "")
      .eq("channel", channel)
      .eq("canonical_url", canonicalUrl);

    if (error) {
      throw error;
    }
    await this.touchUserSyncState(scope.userId, { reset: true });
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
      .select(`id, user_id, expires_at, created_at, users!inner(${USER_SELECT_FIELDS})`)
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

  async deleteSessionsByUser(userId) {
    const { error } = await this.client.from("user_sessions").delete().eq("user_id", userId);

    if (error) {
      throw error;
    }
  }

  async clearUserData(userId) {
    const [tasksResult, recordsResult, summariesResult, contentItemsResult, contentSourcesResult, favoritesResult] = await Promise.all([
      this.client.from("tasks").delete().eq("user_id", userId),
      this.client.from("daily_records").delete().eq("user_id", userId),
      this.client.from("weekly_summaries").delete().eq("user_id", userId),
      this.client.from("content_items").delete().eq("user_id", userId),
      this.client.from("content_sources").delete().eq("user_id", userId),
      this.client.from("content_favorites").delete().eq("user_id", userId),
    ]);

    if (
      tasksResult.error ||
      recordsResult.error ||
      summariesResult.error ||
      contentItemsResult.error ||
      contentSourcesResult.error ||
      favoritesResult.error
    ) {
      throw (
        tasksResult.error ||
        recordsResult.error ||
        summariesResult.error ||
        contentItemsResult.error ||
        contentSourcesResult.error ||
        favoritesResult.error
      );
    }

    await this.touchUserSyncState(userId, { reset: true });
  }

  async getUserSyncState(userId) {
    const { data, error } = await this.client
      .from("users")
      .select("data_updated_at, data_reset_at, created_at")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    return {
      dataUpdatedAt: data.data_updated_at || data.created_at || "",
      dataResetAt: data.data_reset_at || "",
    };
  }

  async deleteUserAccount(userId) {
    await this.clearUserData(userId);
    const { error } = await this.client.from("users").delete().eq("id", userId);
    if (error) {
      throw error;
    }
  }
}

module.exports = { SupabaseStore, buildTableAvailabilityError };
