const { formatSyncCursor, parseSyncCursor } = require("./sync-cursor");

function createStateContinuityPersistence({ store }) {
  async function snapshot(userContext) {
    const projection = await store.readStateContinuityProjection(userContext.userId);
    const { syncState, upperVersion } = projection;
    return {
      cursor: formatSyncCursor(upperVersion),
      resetAt: Number(syncState?.dataResetVersion || 0) ? formatSyncCursor(syncState.dataResetVersion) : "",
      snapshot: projection.snapshot,
    };
  }

  async function changes(userContext, sinceCursor) {
    const sinceVersion = parseSyncCursor(sinceCursor);
    if (sinceVersion === null) return { ...(await snapshot(userContext)), reset: true };
    const projection = await store.readStateContinuityProjection(userContext.userId, { since: sinceVersion });
    const { syncState, upperVersion } = projection;
    const resetVersion = Number(syncState?.dataResetVersion || 0);
    if (resetVersion > sinceVersion) {
      return {
        cursor: formatSyncCursor(upperVersion), reset: true,
        resetAt: resetVersion ? formatSyncCursor(resetVersion) : "", snapshot: projection.snapshot,
      };
    }
    return {
      cursor: formatSyncCursor(upperVersion), reset: false,
      resetAt: resetVersion ? formatSyncCursor(resetVersion) : "", changes: projection.changes,
    };
  }
  return { snapshot, changes };
}

module.exports = { createStateContinuityPersistence };
