import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("退出安全 Demo 会先关闭 Demo 身份，再返回公开页", async () => {
  const [shellSource, sessionSource] = await Promise.all([
    readFile(new URL("../src/components/layout/AppShell.vue", import.meta.url), "utf8"),
    readFile(new URL("../src/stores/session.js", import.meta.url), "utf8"),
  ]);

  assert.match(shellSource, /async function exitDemo\(\) \{\s+await sessionStore\.signOut\(\);\s+await router\.push\("\/"\);\s+\}/);
  assert.match(shellSource, /v-if="sessionStore\.previewMode"[\s\S]{0,240}退出 Demo/);
  assert.match(sessionSource, /this\.previewMode = false;[\s\S]{0,180}stateContinuity\.transition\(null, \{ purgePrevious: true \}\)/);
  assert.match(sessionSource, /wasPreviewMode \? "已退出安全 Demo" : "已退出登录"/);
});
