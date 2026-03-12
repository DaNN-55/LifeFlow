const { config } = require("./config");
const { createApp } = require("./app");
const { createStore } = require("./store");
const { startContentRefreshLoop } = require("./lib/content");

async function main() {
  const store = createStore(config);
  if (typeof store.init === "function") {
    await store.init();
  }
  const app = createApp({ config, store });
  startContentRefreshLoop(store);

  app.listen(config.port, () => {
    console.log(
      `[lifeflow-backend] listening on http://localhost:${config.port} using ${
        config.useSupabase ? "supabase" : "memory"
      } storage`
    );
  });
}

main().catch((error) => {
  console.error("[lifeflow-backend] failed to start", error);
  process.exitCode = 1;
});
