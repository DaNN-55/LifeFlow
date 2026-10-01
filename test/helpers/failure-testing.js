import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer as createHttpServer } from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createPinia, setActivePinia } from "pinia";
import { createServer as createViteServer } from "vite";

const require = createRequire(import.meta.url);
const { createApp } = require("../../backend/src/app.js");
const { MemoryStore } = require("../../backend/src/store/memoryStore.js");
const { createInformationInput } = require("../../backend/src/information-input/index.js");
const { createInformationInputPersistence } = require("../../backend/src/information-input/persistence.js");

export const CACHE_KEY = "lifeflow-private-dashboard-vue-dashboard-cache";
export const API_KEY = "lifeflow-private-dashboard-api-base";

export function memoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

export function installBrowser(t, { storage = memoryStorage(), fetch } = {}) {
  for (const [key, value] of Object.entries({
    localStorage: storage,
    window: { setTimeout, clearTimeout, location: { hostname: "audit.invalid", protocol: "http:" } },
    fetch: fetch || (async () => { throw new Error("Unexpected network request in isolated audit"); }),
  })) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    });
  }
  return storage;
}

// Uses actual Express routes and MemoryStore. Every fetch is confined to this
// random loopback port; no .env-selected store or external collector is used.
export async function isolatedAccount(t) {
  const nativeFetch = globalThis.fetch;
  const store = new MemoryStore();
  const user = await store.createUser({
    id: "failure-test-user", username: "failure-test-user", preferences: {},
    created_at: new Date().toISOString(),
  });
  await store.createSession({
    id: "failure-test-session", user_id: user.id,
    expires_at: new Date(Date.now() + 3600000).toISOString(),
  });
  const informationInput = createInformationInput({
    persistence: createInformationInputPersistence(store),
    collector: { fetchIncrement: async () => { throw new Error("External collection disabled in audit"); } },
  });
  const server = createHttpServer(createApp({
    config: { corsOrigins: [], useSupabase: false, authChallengeProvider: "none" },
    store, informationInput,
  }));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    const closed = once(server, "close");
    server.close();
    server.closeAllConnections();
    await closed;
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const requests = [];
  let interceptor = null;
  const localFetch = async (input, options = {}) => {
    const url = new URL(String(input));
    assert.equal(url.origin, baseUrl, "Audit must never contact another server");
    requests.push({ path: url.pathname, method: options.method || "GET", body: options.body });
    const intercepted = interceptor?.(url, options);
    if (intercepted !== undefined) return intercepted;
    return nativeFetch(url, options);
  };
  const storage = memoryStorage({ [API_KEY]: baseUrl });
  installBrowser(t, { storage, fetch: localFetch });
  window.location.hostname = "127.0.0.1";
  window.LIFEFLOW_API_BASE = baseUrl;
  const vite = await createViteServer({
    root: fileURLToPath(new URL("../../", import.meta.url)),
    configFile: false, envFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: { server } }, appType: "custom",
  });
  t.after(() => vite.close());
  const { saveSessionId } = await vite.ssrLoadModule("/src/services/config.js");
  saveSessionId("failure-test-session");
  const { useSessionStore } = await vite.ssrLoadModule("/src/stores/session.js");
  const { useAccountStore } = await vite.ssrLoadModule("/src/stores/account.js");
  const { useTodayStore } = await vite.ssrLoadModule("/src/stores/today.js");
  const { stateContinuity } = await vite.ssrLoadModule("/src/services/state-continuity.js");
  setActivePinia(createPinia());
  const session = useSessionStore();
  session.user = user;
  session.status = "ready";
  session.previewMode = false;
  t.after(() => stateContinuity.transition(null));
  return {
    store, storage, user, scope: { userId: user.id }, requests,
    account: useAccountStore(), today: useTodayStore(), stateContinuity,
    intercept: (handler) => { interceptor = handler; },
    request: (path, options = {}) => localFetch(`${baseUrl}${path}`, {
      ...options,
      headers: { "content-type": "application/json", "x-session-id": "failure-test-session", ...options.headers },
    }),
  };
}

export function backupFile(data) {
  return new File([JSON.stringify({ data })], "fixture-backup.json", { type: "application/json" });
}
