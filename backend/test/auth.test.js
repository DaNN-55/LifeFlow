const test = require("node:test");
const assert = require("node:assert/strict");
const {
  hashPassword,
  verifyPassword,
  generateRecoveryCode,
  buildRecoveryCodeHash,
  verifyRecoveryCode,
} = require("../src/lib/auth");

test("hashPassword verifies the original password only", async () => {
  const hash = await hashPassword("abc12345");

  assert.equal(await verifyPassword("abc12345", hash), true);
  assert.equal(await verifyPassword("wrong-pass", hash), false);
});

test("recovery codes are formatted and verified case-insensitively", async () => {
  const recoveryCode = generateRecoveryCode();
  const hash = await buildRecoveryCodeHash(recoveryCode);

  assert.match(recoveryCode, /^[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}$/);
  assert.equal(await verifyRecoveryCode(recoveryCode.toLowerCase(), hash), true);
  assert.equal(await verifyRecoveryCode("ZZZZ-ZZZZ-ZZZZ-ZZZZ", hash), false);
});
