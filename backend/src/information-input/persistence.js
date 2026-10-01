function createInformationInputPersistence(store) {
  // Serialize source mutations and refresh confirmation, never the network
  // collection itself. A source may be deleted while a fetch is in flight.
  const writesByUser = new Map();
  async function withUserWrite(userContext, operation) {
    const key = userContext.userId || "";
    const previous = writesByUser.get(key) || Promise.resolve();
    const pending = previous.catch(() => undefined).then(operation);
    writesByUser.set(key, pending);
    try {
      return await pending;
    } finally {
      if (writesByUser.get(key) === pending) writesByUser.delete(key);
    }
  }
  async function queryContent(userContext, { filters, favoritesOnly = false }) {
    const [favoriteUrls, result, facets] = await Promise.all([
      favoritesOnly ? Promise.resolve([]) : store.listFavoriteContentUrls(userContext, filters.channel),
      favoritesOnly ? store.listFavoriteContent(userContext, filters) : store.listContent(userContext, filters),
      favoritesOnly ? store.listFavoriteContentFacets(userContext, filters.channel) : store.listContentFacets(userContext, filters.channel),
    ]);
    return {
      ...result,
      items: (result.items || []).map((item) => ({ ...item, is_favorite: favoritesOnly || favoriteUrls.includes(item.canonical_url) })),
      tags: facets.tags || [],
      sources: facets.sources || [],
    };
  }

  async function confirmRefresh(userContext, { channel, results, cutoffIso }) {
    if (results.length === 0) {
      // A source may have been added since the refresh read the source list.
      if (!(await store.listContentSources(userContext, channel)).length) {
        await store.replaceContentItems(userContext, channel, []);
      }
      return { refreshedSourceIds: [] };
    }
    const refreshedSourceIds = [];
    for (const result of results) {
      const currentSource = await store.getContentSource(userContext, result.source.id);
      if (!currentSource || !currentSource.enabled
        || currentSource.channel !== result.source.channel
        || currentSource.url !== result.source.url || currentSource.type !== result.source.type
        || String(currentSource.parser_key || "") !== String(result.source.parser_key || "")) continue;
      if (result.ok) {
        if (result.items.length) await store.upsertContentItems(userContext, result.items);
        await store.updateContentSourceSync(userContext, result.source.id, {
          last_synced_at: result.syncedAt, last_success_at: result.syncedAt, last_error: "", latest_published_at: result.latestPublishedAt,
        });
        refreshedSourceIds.push(result.source.id);
      } else {
        await store.updateContentSourceSync(userContext, result.source.id, {
          last_synced_at: result.syncedAt, last_failure_at: result.syncedAt, last_error: result.errorMessage,
        });
      }
    }
    if (refreshedSourceIds.length) {
      await store.pruneExpiredContentItems(userContext, { channel, sourceIds: refreshedSourceIds, cutoffIso });
    }
    return { refreshedSourceIds };
  }

  async function syncProjection(userContext, { since = null, upperVersion = null } = {}) {
      if (since === null) {
        const [sources, items, favorites] = await Promise.all([
          store.listContentSources(userContext, "", { upperVersion }),
          store.listContentUpdatedSince(userContext, null, "", upperVersion),
          store.listFavoriteContentUpdatedSince(userContext, null, "", upperVersion),
        ]);
        return { sources, items, favorites };
      }
      const [sources, items, favorites] = await Promise.all([
        store.listContentSourcesUpdatedSince(userContext, since, upperVersion),
        store.listContentUpdatedSince(userContext, since, "", upperVersion),
        store.listFavoriteContentUpdatedSince(userContext, since, "", upperVersion),
      ]);
      return { sources, items, favorites };
  }

  return {
    queryContent,
    listSources: (userContext, channel, options) => store.listContentSources(userContext, channel, options),
    getSource: (userContext, sourceId) => store.getContentSource(userContext, sourceId),
    createSource: (userContext, source) => withUserWrite(userContext, () => store.createContentSource(userContext, source)),
    updateSource: (userContext, sourceId, patch) => withUserWrite(userContext, () => store.updateContentSource(userContext, sourceId, patch)),
    deleteSource: (userContext, sourceId) => withUserWrite(userContext, () => store.deleteContentSource(userContext, sourceId)),
    saveFavorite: (userContext, item) => store.upsertFavoriteContent(userContext, item),
    removeFavorite: (userContext, channel, canonicalUrl) => store.deleteFavoriteContent(userContext, channel, canonicalUrl),
    confirmRefresh: (userContext, result) => withUserWrite(userContext, () => confirmRefresh(userContext, result)),
    syncProjection,
  };
}

module.exports = { createInformationInputPersistence };
