function createMemoryContentCollector(itemsBySource = {}) {
  return {
    async fetchIncrement(source) {
      const items = typeof itemsBySource === "function"
        ? await itemsBySource(source)
        : itemsBySource[source.id] || [];
      return items.map((item) => ({ ...item }));
    },
  };
}

module.exports = { createMemoryContentCollector };
