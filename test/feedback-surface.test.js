import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function read(relativePath) {
  return readFile(new URL(relativePath, root), "utf8");
}

test("公开页面和工作区都提供低干扰的 GitHub 反馈入口", async () => {
  const [landing, shell] = await Promise.all([
    read("src/views/LandingView.vue"),
    read("src/components/layout/AppShell.vue"),
  ]);

  for (const source of [landing, shell]) {
    assert.match(source, /https:\/\/github\.com\/DaNN-55\/LifeFlow\/issues\/new\/choose/);
    assert.match(source, /反馈/);
    assert.match(source, /target="_blank"/);
  }
});

test("Issue Form 覆盖结构化体验反馈、Bug 字段和安全边界", async () => {
  const [feedback, bug, config, contributing, security] = await Promise.all([
    read(".github/ISSUE_TEMPLATE/feedback.yml"),
    read(".github/ISSUE_TEMPLATE/bug-report.yml"),
    read(".github/ISSUE_TEMPLATE/config.yml"),
    read("CONTRIBUTING.md"),
    read("SECURITY.md"),
  ]);

  for (const field of ["understanding", "stopped_at", "core_flow", "reuse_intent"]) {
    assert.match(feedback, new RegExp(`id: ${field}`));
  }
  for (const field of ["page", "reproduction", "expected", "actual", "browser"]) {
    assert.match(bug, new RegExp(`id: ${field}`));
  }
  for (const source of [feedback, bug, contributing]) {
    assert.match(source, /任务名/);
    assert.match(source, /执行备注/);
    assert.match(source, /Session/);
  }
  assert.match(config, /blank_issues_enabled: false/);
  assert.match(security, /Session/);
  assert.match(security, /不要通过公开 GitHub Issue/);
});

test("反馈链接只使用 GitHub 模板入口允许的静态参数", async () => {
  const sources = await Promise.all([
    read("README.md"),
    read("CONTRIBUTING.md"),
  ]);
  const links = sources.flatMap((source) => source.match(/https:\/\/github\.com\/DaNN-55\/LifeFlow\/issues\/new[^)\s]*/g) || []);

  assert.ok(links.length >= 3);
  for (const link of links) {
    const query = link.split("?")[1];
    if (!query) continue;
    assert.match(query, /^template=[a-z-]+\.yml$/);
  }
});
