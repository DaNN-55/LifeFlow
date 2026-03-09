const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function splitOrigins(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const config = {
  port: Number(process.env.PORT || 8787),
  corsOrigins: splitOrigins(process.env.CORS_ORIGIN || "http://localhost:8000"),
  writeKey: process.env.APP_WRITE_KEY || "",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
};

config.useSupabase = Boolean(config.supabaseUrl && config.supabaseServiceRoleKey);

module.exports = { config };
