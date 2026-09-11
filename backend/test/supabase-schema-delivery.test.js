const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const SUPABASE_DIR = path.join(__dirname, "../supabase");

test("Supabase delivery guide exposes schema.sql as the only public setup path", () => {
  const guide = fs.readFileSync(path.join(SUPABASE_DIR, "README.md"), "utf8");

  assert.equal(fs.existsSync(path.join(SUPABASE_DIR, "schema.sql")), true);
  assert.equal(fs.existsSync(path.join(SUPABASE_DIR, "migrations")), false);
  assert.match(guide, /只执行一次[\s\S]*?\[`schema\.sql`\]\(schema\.sql\)/);
  assert.doesNotMatch(guide, /`migrations\/[^`]+\.sql`/);
});

test("Supabase baseline includes the final database objects", () => {
  const schema = fs.readFileSync(path.join(SUPABASE_DIR, "schema.sql"), "utf8");

  for (const pattern of [
    /user_id text not null/,
    /archived boolean not null default false/,
    /lifecycle_events jsonb not null default '\[\]'::jsonb/,
    /recovery_code_hash text not null default ''/,
    /preferences jsonb not null default '\{\}'::jsonb/,
    /data_sync_version bigint not null default 0/,
    /idx_content_items_user_source_published_at on public\.content_items \(user_id, source_id, published_at desc\)/,
    /create trigger content_items_assign_lifeflow_sync_version/,
    /function public\.assign_lifeflow_sync_version\(\)[\s\S]*?set search_path = public/,
  ]) {
    assert.match(schema, pattern);
  }
  assert.doesNotMatch(schema, /is_default/);
});
