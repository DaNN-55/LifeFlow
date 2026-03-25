const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";
const TURNSTILE_TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";

function splitOrigins(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

const DEV_CORS_ORIGINS = [
  "http://localhost:8000",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:8787",
  "http://127.0.0.1:8787",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5175",
  "https://life-flow-*.vercel.app",
];

function buildCorsOrigins(value) {
  return [...new Set([...DEV_CORS_ORIGINS, ...splitOrigins(value)])];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildCorsOriginPattern(origin) {
  if (!origin.includes("*")) {
    return null;
  }

  return new RegExp(
    `^${origin
      .split("*")
      .map((segment) => escapeRegExp(segment))
      .join(".*")}$`
  );
}

function isCorsOriginAllowed(allowedOrigins, origin) {
  const normalizedOrigin = String(origin || "").trim().replace(/\/+$/, "");
  if (!normalizedOrigin || allowedOrigins.length === 0) {
    return true;
  }

  return allowedOrigins.some((candidate) => {
    if (candidate === normalizedOrigin) {
      return true;
    }

    const pattern = buildCorsOriginPattern(candidate);
    return pattern ? pattern.test(normalizedOrigin) : false;
  });
}

const config = {
  port: Number(process.env.PORT || 8787),
  corsOrigins: buildCorsOrigins(process.env.CORS_ORIGIN || ""),
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  nodeEnv: process.env.NODE_ENV || "development",
  authChallengeEnabled: String(process.env.AUTH_CHALLENGE_ENABLED || "true").toLowerCase() !== "false",
};

config.useSupabase = Boolean(config.supabaseUrl && config.supabaseServiceRoleKey);
config.turnstileSiteKey =
  process.env.TURNSTILE_SITE_KEY ||
  (config.nodeEnv === "production" ? "" : TURNSTILE_TEST_SITE_KEY);
config.turnstileSecretKey =
  process.env.TURNSTILE_SECRET_KEY ||
  (config.nodeEnv === "production" ? "" : TURNSTILE_TEST_SECRET_KEY);
config.authChallengeProvider =
  !config.authChallengeEnabled
    ? "none"
    : config.turnstileSiteKey && config.turnstileSecretKey
      ? "turnstile"
      : "captcha";

module.exports = { config, isCorsOriginAllowed };
