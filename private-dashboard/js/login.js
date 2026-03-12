const AUTH_CONFIG_STORAGE_KEY = "lifeflow-private-dashboard-auth-config";
const SESSION_STORAGE_KEY = "lifeflow-private-dashboard-session";
const API_BASE_STORAGE_KEY = "lifeflow-private-dashboard-api-base";
const DEFAULT_API_BASE = "https://lifeflow-backend-mrs1.onrender.com";

const authElements = {
  form: document.querySelector("#login-form"),
  feedback: document.querySelector("#login-feedback"),
  captchaImage: document.querySelector("#captcha-image"),
};

const SIGNUP_REQUIREMENTS_TEXT =
  "创建账号要求：用户名 3-64 位且不能包含空格；密码 6-128 位。支持邮箱作为用户名。";

const captchaState = {
  id: "",
};
let resolvedApiBase = "";

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

function saveApiBase(apiBase) {
  if (!apiBase) {
    localStorage.removeItem(API_BASE_STORAGE_KEY);
    return;
  }
  localStorage.setItem(API_BASE_STORAGE_KEY, String(apiBase).trim());
}

function setFeedback(message) {
  authElements.feedback.textContent = message || "";
}

function renderCaptchaImage(svgMarkup) {
  if (!authElements.captchaImage) {
    return;
  }
  authElements.captchaImage.innerHTML = "";
  if (!svgMarkup) {
    authElements.captchaImage.textContent = "加载失败";
    return;
  }
  const image = document.createElement("img");
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
  image.alt = "图形验证码";
  image.decoding = "async";
  authElements.captchaImage.append(image);
}

function buildAuthErrorMessage(error, mode) {
  const message = String(error?.message || "").trim();
  if (message.includes("验证码错误或已过期")) {
    return "验证码错误或已过期，请重新输入。";
  }
  if (mode === "signup") {
    if (message.includes("用户名已存在")) {
      return "创建账号失败：该用户名已存在。";
    }
    if (message.includes("Validation failed")) {
      return `创建账号失败。${SIGNUP_REQUIREMENTS_TEXT}`;
    }
    return message ? `创建账号失败：${message}` : `创建账号失败。${SIGNUP_REQUIREMENTS_TEXT}`;
  }
  return message ? `登录失败：${message}` : "登录失败，请检查用户名和密码。";
}

function redirectToDashboard() {
  window.location.href = "./index.html";
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function detectApiBase() {
  if (resolvedApiBase) {
    return resolvedApiBase;
  }
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
        resolvedApiBase = baseUrl;
        return resolvedApiBase;
      }
    } catch (error) {
      // continue
    }
  }

  resolvedApiBase = DEFAULT_API_BASE;
  return resolvedApiBase;
}

async function fetchApiJson(path, options = {}) {
  const apiBase = await detectApiBase();
  saveApiBase(apiBase);
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
    const error = new Error(payload.error || `Request failed: ${response.status}`);
    error.payload = payload;
    error.status = response.status;
    throw error;
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

async function refreshCaptcha() {
  try {
    const payload = await fetchApiJson("/api/auth/captcha");
    captchaState.id = payload?.captcha?.id || "";
    renderCaptchaImage(payload?.captcha?.svg || "");
    if (authElements.form?.elements?.captchaText) {
      authElements.form.elements.captchaText.value = "";
    }
  } catch (error) {
    captchaState.id = "";
    renderCaptchaImage("");
  }
}

async function handlePasswordAuth(formData, mode = "signin") {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  const captchaText = String(formData.get("captchaText") || "").trim();

  if (!username || !password || !captchaText) {
    setFeedback("请填写用户名、密码和验证码。");
    return;
  }

  if (!captchaState.id) {
    setFeedback("验证码尚未准备好，请刷新后重试。");
    return;
  }

  saveAuthConfig({ username });
  setFeedback(mode === "signup" ? "正在创建账号..." : "正在登录...");

  try {
    await fetchApiJson(`/api/auth/${mode === "signup" ? "signup" : "signin"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, captchaId: captchaState.id, captchaText }),
    }).then((payload) => {
      saveSessionId(payload?.session?.id || "");
      return payload;
    });
    setFeedback(mode === "signup" ? "创建成功，正在进入 Dashboard..." : "登录成功，正在进入 Dashboard...");
    await wait(500);
    redirectToDashboard();
  } catch (error) {
    console.warn("Password auth failed on login page.", error);
    setFeedback(buildAuthErrorMessage(error, mode));
    await refreshCaptcha();
  }
}

function handleLoginSubmit(event) {
  event.preventDefault();
  const action = event.submitter?.dataset.authAction || "signin";
  void handlePasswordAuth(new FormData(authElements.form), action);
}

authElements.form.addEventListener("submit", handleLoginSubmit);
if (authElements.captchaImage) {
  authElements.captchaImage.addEventListener("click", () => {
    void refreshCaptcha();
  });
}
setFeedback(SIGNUP_REQUIREMENTS_TEXT);
void refreshCaptcha();
void bootstrapExistingSession();
