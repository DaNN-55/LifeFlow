const AUTH_CONFIG_STORAGE_KEY = "lifeflow-private-dashboard-auth-config";
const ENTRY_MODE_STORAGE_KEY = "lifeflow-private-dashboard-entry-mode";

const authElements = {
  form: document.querySelector("#login-form"),
  feedback: document.querySelector("#login-feedback"),
  trialAction: document.querySelector("#trial-login-action"),
};

const authState = {
  client: null,
  config: loadAuthConfig(),
};

function loadAuthConfig() {
  const runtimeConfig =
    typeof window !== "undefined" && window.LIFEFLOW_AUTH_CONFIG
      ? {
          supabaseUrl: String(window.LIFEFLOW_AUTH_CONFIG.supabaseUrl || "").trim(),
          supabaseAnonKey: String(
            window.LIFEFLOW_AUTH_CONFIG.supabaseAnonKey || "",
          ).trim(),
        }
      : { supabaseUrl: "", supabaseAnonKey: "" };

  try {
    const raw = localStorage.getItem(AUTH_CONFIG_STORAGE_KEY);
    if (!raw) {
      return { ...runtimeConfig, email: "" };
    }
    const parsed = JSON.parse(raw);
    return {
      supabaseUrl: runtimeConfig.supabaseUrl,
      supabaseAnonKey: runtimeConfig.supabaseAnonKey,
      email: typeof parsed.email === "string" ? parsed.email.trim() : "",
    };
  } catch (error) {
    return { ...runtimeConfig, email: "" };
  }
}

function saveAuthConfig(config) {
  localStorage.setItem(
    AUTH_CONFIG_STORAGE_KEY,
    JSON.stringify({
      supabaseUrl: config.supabaseUrl,
      supabaseAnonKey: config.supabaseAnonKey,
      email: config.email,
    }),
  );
}

function saveEntryMode(mode) {
  localStorage.setItem(
    ENTRY_MODE_STORAGE_KEY,
    mode === "trial" ? "trial" : "login",
  );
}

function setFeedback(message) {
  authElements.feedback.textContent = message || "";
}

function redirectToDashboard() {
  window.location.href = "./index.html";
}

async function initAuthClient() {
  if (authState.client) {
    return authState.client;
  }

  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  authState.client = createClient(
    authState.config.supabaseUrl,
    authState.config.supabaseAnonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    },
  );

  return authState.client;
}

async function bootstrapExistingSession() {
  const client = await initAuthClient();
  const {
    data: { session },
  } = await client.auth.getSession();

  if (session?.user) {
    saveEntryMode("login");
    redirectToDashboard();
    return;
  }

  if (authState.config.email) {
    authElements.form.elements.email.value = authState.config.email;
  }
}

async function handlePasswordAuth(formData, mode = "signin") {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    setFeedback("请先填写邮箱和密码。");
    return;
  }

  authState.config = {
    ...authState.config,
    email,
  };
  saveAuthConfig(authState.config);
  setFeedback(mode === "signup" ? "正在创建账号..." : "正在登录...");

  try {
    const client = await initAuthClient();
    let result;

    if (mode === "signup") {
      result = await client.auth.signUp({
        email,
        password,
      });
    } else {
      result = await client.auth.signInWithPassword({
        email,
        password,
      });
    }

    if (result.error) {
      throw result.error;
    }

    if (result.data?.session?.user) {
      saveEntryMode("login");
      redirectToDashboard();
      return;
    }

    setFeedback(
      mode === "signup"
        ? "账号已创建。若 Supabase 开启邮箱确认，请先完成确认后再登录。"
        : "登录完成，但未返回会话，请检查 Supabase Auth 设置。",
    );
  } catch (error) {
    console.warn("Password auth failed on login page.", error);
    setFeedback(
      mode === "signup"
        ? "创建账号失败，请检查邮箱是否已注册或密码是否符合要求。"
        : "登录失败，请检查邮箱和密码。",
    );
  }
}

function enterTrialMode() {
  saveEntryMode("trial");
  redirectToDashboard();
}

function handleLoginSubmit(event) {
  event.preventDefault();
  const action = event.submitter?.dataset.authAction || "signin";
  void handlePasswordAuth(new FormData(authElements.form), action);
}

authElements.form.addEventListener("submit", handleLoginSubmit);
authElements.trialAction.addEventListener("click", enterTrialMode);
void bootstrapExistingSession();
