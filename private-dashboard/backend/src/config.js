const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function splitOrigins(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const DEV_CORS_ORIGINS = [
  "http://localhost:8000",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:8787",
  "http://127.0.0.1:8787",
];

function buildCorsOrigins(value) {
  return [...new Set([...DEV_CORS_ORIGINS, ...splitOrigins(value)])];
}

const config = {
  port: Number(process.env.PORT || 8787),
  corsOrigins: buildCorsOrigins(process.env.CORS_ORIGIN || ""),
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
};

config.useSupabase = Boolean(config.supabaseUrl && config.supabaseServiceRoleKey);

module.exports = { config };
