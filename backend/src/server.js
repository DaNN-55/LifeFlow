const { config } = require("./config");
const { createApp } = require("./app");
const { createStore } = require("./store");
const { createInformationInput } = require("./information-input");
const { createInformationInputPersistence } = require("./information-input/persistence");
const { createProductionContentCollector } = require("./information-input/productionCollector");

async function main() {
  const store = createStore(config);
  if (typeof store.init === "function") {
    await store.init();
  }
  const now = () => new Date();
  const informationInput = createInformationInput({
    persistence: createInformationInputPersistence(store),
    collector: createProductionContentCollector({ now }),
    now,
  });
  const app = createApp({ config, store, informationInput });

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
