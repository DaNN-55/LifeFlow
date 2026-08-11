import assert from "node:assert/strict";
import test from "node:test";
import { createPinia, setActivePinia } from "pinia";
import { createServer } from "vite";

test("Home 在新身份 supplemental 为空时清除旧身份 widget 状态", async () => {
  const previousStorage = globalThis.localStorage;
  const previousWindow = globalThis.window;
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  globalThis.window = { setTimeout, clearTimeout, location: { hostname: "home.test", protocol: "http:" } };
  const vite = await createServer({ server: { middlewareMode: true, hmr: { port: 24681 } }, appType: "custom" });

  try {
    const { useHomeStore } = await vite.ssrLoadModule("/src/stores/home.js");
    setActivePinia(createPinia());
    const home = useHomeStore();
    home.applyCachedHome({
      github: { status: "ready", repos: [{ name: "Alice" }] },
      weather: { status: "ready", location: "Alice" },
      stock: { status: "ready", symbols: [{ code: "A" }] },
    });

    home.applyCachedHome({});

    assert.equal(home.github.status, "idle");
    assert.deepEqual(home.github.repos, []);
    assert.equal(home.weather.status, "idle");
    assert.equal(home.stock.status, "idle");
    assert.deepEqual(home.stock.symbols, []);
  } finally {
    await vite.close();
    globalThis.localStorage = previousStorage;
    globalThis.window = previousWindow;
  }
});
