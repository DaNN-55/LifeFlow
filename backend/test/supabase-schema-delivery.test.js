const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const SUPABASE_DIR = path.join(__dirname, "../supabase");

test("Supabase delivery guide lists each legacy migration exactly once", () => {
  const guide = fs.readFileSync(path.join(SUPABASE_DIR, "README.md"), "utf8");
  const listedMigrations = Array.from(
    guide.matchAll(/^\d+\. `migrations\/([^`]+\.sql)`$/gm),
    ([, filename]) => filename
  );
  const migrationFiles = fs.readdirSync(path.join(SUPABASE_DIR, "migrations"))
    .filter((filename) => filename.endsWith(".sql"))
    .sort();

  assert.equal(fs.existsSync(path.join(SUPABASE_DIR, "schema.sql")), true);
  assert.equal(new Set(listedMigrations).size, listedMigrations.length);
  assert.deepEqual([...listedMigrations].sort(), migrationFiles);
  assert.match(guide, /新建、空白的 Supabase 项目[\s\S]*?只执行一次 \[`schema\.sql`\]\(schema\.sql\)/);
});
