const test = require("node:test");
const assert = require("node:assert/strict");

const { isCorsOriginAllowed } = require("./config");

test("allows exact localhost origins", () => {
  assert.equal(isCorsOriginAllowed(["http://localhost:5173"], "http://localhost:5173"), true);
});

test("allows configured Vercel preview origins via wildcard", () => {
  assert.equal(
    isCorsOriginAllowed(
      ["https://life-flow-*.vercel.app"],
      "https://life-flow-giyt8lad8-dans-projects-e925b023.vercel.app"
    ),
    true
  );
});

test("rejects unrelated origins", () => {
  assert.equal(
    isCorsOriginAllowed(["https://life-flow-*.vercel.app"], "https://another-app.vercel.app"),
    false
  );
});
