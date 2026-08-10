const { MemoryStore } = require("./memoryStore");
const { SupabaseStore } = require("./supabaseStore");

function createStore(config) {
  if (config.useSupabase) {
    return new SupabaseStore(config);
  }

  return new MemoryStore();
}

module.exports = { createStore };
