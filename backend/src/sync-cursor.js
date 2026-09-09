const CURSOR_PREFIX = "v1.";

function formatSyncCursor(version = 0) {
  const normalized = Number(version);
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw new Error("Sync cursor version must be a non-negative safe integer");
  }
  return `${CURSOR_PREFIX}${normalized.toString(36)}`;
}

function parseSyncCursor(value = "") {
  const raw = String(value || "").trim();
  if (!raw.startsWith(CURSOR_PREFIX)) {
    return null;
  }
  const encoded = raw.slice(CURSOR_PREFIX.length);
  if (!/^[0-9a-z]+$/i.test(encoded)) {
    return null;
  }
  const version = Number.parseInt(encoded, 36);
  return Number.isSafeInteger(version) && version >= 0 ? version : null;
}

module.exports = { formatSyncCursor, parseSyncCursor };
