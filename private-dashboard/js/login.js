const AUTH_CONFIG_STORAGE_KEY = "lifeflow-private-dashboard-auth-config";
const SESSION_STORAGE_KEY = "lifeflow-private-dashboard-session";
const DEFAULT_API_BASE = "https://lifeflow-backend-mrs1.onrender.com";

const authElements = {
  form: document.querySelector("#login-form"),
  feedback: document.querySelector("#login-feedback"),
};

const SIGNUP_REQUIREMENTS_TEXT =
  "创建账号要求：用户名 3-64 位且不能包含空格；密码 6-128 位。支持邮箱作为用户名。";

function loadAuthConfig() {
  try {
    const raw = localStorage.getItem(AUTH_CONFIG_STORAGE_KEY);
    if (!raw) {
      return { username: "" };
    }
    const parsed = JSON.parse(raw);
    return {
      username:
        typeof parsed.username === "string" ? parsed.username.trim() : "",
    };
  } catch (error) {
    return { username: "" };
  }
}

function saveAuthConfig(config) {
  localStorage.setItem(
    AUTH_CONFIG_STORAGE_KEY,
    JSON.stringify({ username: String(config.username || "").trim() }),
  );
}

function loadSessionId() {
  return String(localStorage.getItem(SESSION_STORAGE_KEY) || "").trim();
}

function saveSessionId(sessionId) {
  if (!sessionId) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }
  localStorage.setItem(SESSION_STORAGE_KEY, String(sessionId).trim());
}

function setFeedback(message) {
  authElements.feedback.textContent = message || "";
}

function redirectToDashboard() {
  window.location.href = "./index.html";
}

async function detectApiBase() {
  const runtimeBase =
    typeof window !== "undefined" &&
    typeof window.LIFEFLOW_API_BASE === "string"
      ? window.LIFEFLOW_API_BASE
      : "";
  const localhostBase =
    window.location.hostname && window.location.hostname !== "localhost"
      ? "http://localhost:8787"
      : `${window.location.protocol}//${window.location.hostname || "localhost"}:8787`;
  const candidates = [runtimeBase, localhostBase, "http://127.0.0.1:8787", DEFAULT_API_BASE]
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  for (const baseUrl of [...new Set(candidates)]) {
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, "")}/health`, {
        credentials: "include",
      });
      if (response.ok) {
        return baseUrl;
      }
    } catch (error) {
      // continue
    }
  }

  throw new Error("Remote API unavailable");
}

async function fetchApiJson(path, options = {}) {
  const apiBase = await detectApiBase();
  const headers = new Headers(options.headers || {});
  const sessionId = loadSessionId();
  if (sessionId) {
    headers.set("x-session-id", sessionId);
  }
  const response = await fetch(`${apiBase.replace(/\/$/, "")}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function bootstrapExistingSession() {
  const config = loadAuthConfig();
  if (config.username) {
    authElements.form.elements.username.value = config.username;
  }

  try {
    const payload = await fetchApiJson("/api/auth/me");
    if (payload?.user) {
      saveSessionId(payload?.session?.id || loadSessionId());
      redirectToDashboard();
    }
  } catch (error) {
    saveSessionId("");
    // not signed in
  }
}

async function handlePasswordAuth(formData, mode = "signin") {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");

  if (!username || !password) {
    setFeedback("请先填写用户名和密码。");
    return;
  }

  saveAuthConfig({ username });
  setFeedback(mode === "signup" ? "正在创建账号..." : "正在登录...");

  try {
    await fetchApiJson(`/api/auth/${mode === "signup" ? "signup" : "signin"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }).then((payload) => {
      saveSessionId(payload?.session?.id || "");
      return payload;
    });
    redirectToDashboard();
  } catch (error) {
    console.warn("Password auth failed on login page.", error);
    setFeedback(
      mode === "signup"
        ? `创建账号失败。${SIGNUP_REQUIREMENTS_TEXT}`
        : "登录失败，请检查用户名和密码。",
    );
  }
}

function handleLoginSubmit(event) {
  event.preventDefault();
  const action = event.submitter?.dataset.authAction || "signin";
  void handlePasswordAuth(new FormData(authElements.form), action);
}

authElements.form.addEventListener("submit", handleLoginSubmit);
setFeedback(SIGNUP_REQUIREMENTS_TEXT);
void bootstrapExistingSession();
