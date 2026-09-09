import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  AUTH_SIGNUP_ENABLED,
  resolveAuthSignupEnabled,
} from "../src/app/constants.js";

test("公开部署默认关闭注册，只有显式 true 才开启", () => {
  assert.equal(AUTH_SIGNUP_ENABLED, false);
  assert.equal(resolveAuthSignupEnabled(undefined), false);
  assert.equal(resolveAuthSignupEnabled("false"), false);
  assert.equal(resolveAuthSignupEnabled("1"), false);
  assert.equal(resolveAuthSignupEnabled("TRUE"), true);
  assert.equal(resolveAuthSignupEnabled(" true "), true);
});

test("认证页将注册入口、弹窗和提交路径置于同一开关后", async () => {
  const authViewSource = await readFile(
    new URL("../src/views/AuthView.vue", import.meta.url),
    "utf8",
  );

  assert.match(authViewSource, /v-if="AUTH_SIGNUP_ENABLED"[^>]+@click="openSignupModal"/);
  assert.match(authViewSource, /v-if="AUTH_SIGNUP_ENABLED && signupModalOpen"/);
  assert.match(authViewSource, /mode === "signup" && !AUTH_SIGNUP_ENABLED/);
  assert.match(authViewSource, /async function submitSignup\(\) \{\s+if \(!AUTH_SIGNUP_ENABLED\)/);
  assert.match(authViewSource, /云端账号当前处于封闭测试/);
  assert.match(authViewSource, /进入安全 Demo/);
  assert.match(authViewSource, /router\.replace\("\/demo"\)/);
});
