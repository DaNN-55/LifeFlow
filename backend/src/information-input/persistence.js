const INFORMATION_INPUT_PERSISTENCE_METHODS = [
  "listSources",
  "getSource",
  "createSource",
  "updateSource",
  "updateSourceSync",
  "deleteSource",
  "listSourcesUpdatedSince",
  "upsertItems",
  "replaceItems",
  "pruneExpiredItems",
  "listItems",
  "listItemsUpdatedSince",
  "listItemFacets",
  "listFeaturedItems",
  "listFavoriteItems",
  "listFavoriteItemsUpdatedSince",
  "listFavoriteFacets",
  "listFavoriteUrls",
  "saveFavorite",
  "deleteFavorite",
  "getSyncState",
  "touchSyncState",
];

function createInformationInputPersistence(store) {
  return {
    listSources: (userContext, channel) => store.listContentSources(userContext, channel),
    getSource: (userContext, sourceId) => store.getContentSource(userContext, sourceId),
    createSource: (userContext, source) => store.createContentSource(userContext, source),
    updateSource: (userContext, sourceId, patch) => store.updateContentSource(userContext, sourceId, patch),
    updateSourceSync: (userContext, sourceId, patch) =>
      store.updateContentSourceSync?.(userContext, sourceId, patch),
    deleteSource: (userContext, sourceId) => store.deleteContentSource(userContext, sourceId),
    listSourcesUpdatedSince: (userContext, since) =>
      store.listContentSourcesUpdatedSince(userContext, since),
    upsertItems: (userContext, items) => store.upsertContentItems(userContext, items),
    replaceItems: (userContext, channel, items) => store.replaceContentItems(userContext, channel, items),
    pruneExpiredItems: (userContext, options) => store.pruneExpiredContentItems?.(userContext, options),
    listItems: (userContext, filters) => store.listContent(userContext, filters),
    listItemsUpdatedSince: (userContext, since) => store.listContentUpdatedSince(userContext, since),
    listItemFacets: (userContext, channel) => store.listContentFacets(userContext, channel),
    listFeaturedItems: (userContext, channel, limit) =>
      store.getFeaturedContent(userContext, channel, limit),
    listFavoriteItems: (userContext, filters) => store.listFavoriteContent(userContext, filters),
    listFavoriteItemsUpdatedSince: (userContext, since) =>
      store.listFavoriteContentUpdatedSince(userContext, since),
    listFavoriteFacets: (userContext, channel) => store.listFavoriteContentFacets(userContext, channel),
    listFavoriteUrls: (userContext, channel) => store.listFavoriteContentUrls(userContext, channel),
    saveFavorite: (userContext, item) => store.upsertFavoriteContent(userContext, item),
    deleteFavorite: (userContext, channel, canonicalUrl) =>
      store.deleteFavoriteContent(userContext, channel, canonicalUrl),
    getSyncState: (userId) => store.getUserSyncState(userId),
    touchSyncState: (userId) => store.touchUserSyncState?.(userId),
  };
}

module.exports = { createInformationInputPersistence, INFORMATION_INPUT_PERSISTENCE_METHODS };
