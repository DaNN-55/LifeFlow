const AUTH_CONFIG_STORAGE_KEY = "lifeflow-private-dashboard-auth-config";
const DEFAULT_API_BASE = "https://lifeflow-backend-mrs1.onrender.com";

const authElements = {
  form: document.querySelector("#login-form"),
  feedback: document.querySelector("#login-feedback"),
};

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
  const response = await fetch(`${apiBase.replace(/\/$/, "")}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.headers || {}),
    },
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
      redirectToDashboard();
    }
  } catch (error) {
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
    });
    redirectToDashboard();
  } catch (error) {
    console.warn("Password auth failed on login page.", error);
    setFeedback(
      mode === "signup"
        ? "创建账号失败，请检查用户名是否已存在或密码是否符合要求。"
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
void bootstrapExistingSession();
