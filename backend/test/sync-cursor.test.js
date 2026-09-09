const test = require("node:test");
const assert = require("node:assert/strict");

const { formatSyncCursor, parseSyncCursor } = require("../src/sync-cursor");

test("opaque sync cursors round-trip versions without date semantics", () => {
  assert.equal(formatSyncCursor(0), "v1.0");
  assert.equal(formatSyncCursor(36), "v1.10");
  assert.equal(parseSyncCursor("v1.10"), 36);
  assert.equal(parseSyncCursor("2026-09-09T00:00:00.000Z"), null);
  assert.equal(parseSyncCursor("v1.invalid!"), null);
});
