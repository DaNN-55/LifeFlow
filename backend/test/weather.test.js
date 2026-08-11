const test = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { once } = require("node:events");

const { createApp } = require("../src/app");
const { createInformationInput } = require("../src/information-input");
const { createMemoryContentCollector } = require("../src/information-input/memoryCollector");
const { createInformationInputPersistence } = require("../src/information-input/persistence");
const { MemoryStore } = require("../src/store/memoryStore");

function createTestConfig() {
  return {
    corsOrigins: [],
    useSupabase: false,
    authChallengeProvider: "none",
    turnstileSiteKey: "",
    turnstileSecretKey: "",
  };
}

test("weather endpoint falls back to backup provider when open-meteo fails", async () => {
  const store = new MemoryStore();
  const app = createApp({
    config: createTestConfig(),
    store,
    informationInput: createInformationInput({
      persistence: createInformationInputPersistence(store),
      collector: createMemoryContentCollector(),
    }),
  });
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const originalFetch = global.fetch;

  global.fetch = async (url) => {
    const target = String(url);
    if (target.includes("api.open-meteo.com/v1/forecast")) {
      throw new Error("primary weather provider failed");
    }
    if (target.includes("wttr.in/")) {
      return new Response(
        JSON.stringify({
          current_condition: [
            {
              temp_C: "18",
              weatherDesc: [{ value: "晴间多云" }],
            },
          ],
          weather: [
            { date: "2026-04-08", maxtempC: "21", mintempC: "14" },
            { date: "2026-04-09", maxtempC: "23", mintempC: "16" },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }
    throw new Error(`Unexpected fetch target: ${target}`);
  };

  try {
    const response = await originalFetch(`${baseUrl}/api/widgets/weather`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.weather.provider, "wttr");
    assert.equal(payload.weather.temperature, "18°C");
    assert.equal(payload.weather.detail, "晴间多云");
    assert.equal(payload.weather.forecast.length, 2);
  } finally {
    global.fetch = originalFetch;
    server.close();
    await once(server, "close");
  }
});
