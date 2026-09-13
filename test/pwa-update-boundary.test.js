import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("公开入口发现新 PWA 版本时立即激活，工作区仍保留手动更新", async () => {
  const mainSource = await readFile(
    new URL("../src/main.js", import.meta.url),
    "utf8",
  );

  assert.match(
    mainSource,
    /onNeedRefresh\(\) \{\s+if \(\["landing", "auth"\]\.includes\(router\.currentRoute\.value\.name\)\) \{\s+updateServiceWorker\(true\);\s+return;\s+\}\s+appStore\.notifyUpdateReady\(updateServiceWorker\);/,
  );
});
