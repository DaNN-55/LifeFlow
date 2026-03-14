const AUTH_CONFIG_STORAGE_KEY = "lifeflow-private-dashboard-auth-config";
const SESSION_STORAGE_KEY = "lifeflow-private-dashboard-session";
const API_BASE_STORAGE_KEY = "lifeflow-private-dashboard-api-base";
const DEFAULT_API_BASE = "https://lifeflow-backend-mrs1.onrender.com";
const API_PROBE_TIMEOUT_MS = 1500;

const authElements = {
  form: document.querySelector("#login-form"),
  feedback: document.querySelector("#login-feedback"),
  captchaImage: document.querySelector("#captcha-image"),
  recoveryCodeField: document.querySelector("#recovery-code-field"),
  passwordLabel: document.querySelector("#password-label"),
  recoveryCodeModal: document.querySelector("#recovery-code-modal"),
  recoveryCodeValue: document.querySelector("#recovery-code-value"),
  recoveryCodeConfirm: document.querySelector("#recovery-code-confirm"),
};

const SIGNUP_REQUIREMENTS_TEXT =
  "创建账号要求：用户名 3-64 位且不能包含空格；密码 6-128 位。支持邮箱作为用户名。";

const captchaState = {
  id: "",
};
const authUiState = {
  mode: "signin",
  pendingRedirect: false,
};
let resolvedApiBase = "";
let apiBasePromise = null;

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
  authElements.captchaImage.innerHTML = svgMarkup;
  const inlineSvg = authElements.captchaImage.querySelector("svg");
  if (inlineSvg) {
    inlineSvg.setAttribute("aria-hidden", "true");
    inlineSvg.setAttribute("focusable", "false");
  }
}

function buildAuthErrorMessage(error, mode) {
  const message = String(error?.message || "").trim();
  if (message.includes("验证码错误或已过期")) {
    return "验证码错误或已过期，请重新输入。";
  }
  if (mode === "recover") {
    if (message.includes("恢复码错误")) {
      return "恢复码错误，请检查后重试。";
    }
    if (message.includes("Validation failed")) {
      return "重置失败。请填写用户名、恢复码、新密码和验证码。";
    }
    return message ? `重置失败：${message}` : "重置失败，请检查恢复码和新密码。";
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
  if (window.location.protocol === "file:") {
    setFeedback(
      "当前是本地文件打开模式。请改用 http://localhost:8000/private-dashboard/login.html 访问，再进入 Dashboard。",
    );
    return;
  }
  window.location.href = "./index.html";
}

function setAuthMode(mode) {
  authUiState.mode = mode;
  const isRecoveryMode = mode === "recover";
  if (authElements.recoveryCodeField) {
    authElements.recoveryCodeField.hidden = !isRecoveryMode;
  }
  if (authElements.passwordLabel) {
    authElements.passwordLabel.textContent = isRecoveryMode ? "新密码" : "密码";
  }
  if (authElements.form?.elements?.password) {
    authElements.form.elements.password.placeholder = isRecoveryMode
      ? "输入新的登录密码"
      : "输入你的密码";
    authElements.form.elements.password.autocomplete = isRecoveryMode
      ? "new-password"
      : "current-password";
  }
}

function openRecoveryCodeModal(recoveryCode, nextStep = "redirect") {
  if (!authElements.recoveryCodeModal || !authElements.recoveryCodeValue) {
    window.alert(`请保存恢复码：${recoveryCode}`);
    if (nextStep === "redirect") {
      redirectToDashboard();
    }
    return;
  }
  authUiState.pendingRedirect = nextStep === "redirect";
  authElements.recoveryCodeValue.textContent = String(recoveryCode || "").trim();
  authElements.recoveryCodeModal.hidden = false;
}

function closeRecoveryCodeModal() {
  if (authElements.recoveryCodeModal) {
    authElements.recoveryCodeModal.hidden = true;
  }
  if (authElements.recoveryCodeValue) {
    authElements.recoveryCodeValue.textContent = "";
  }
  const shouldRedirect = authUiState.pendingRedirect;
  authUiState.pendingRedirect = false;
  if (shouldRedirect) {
    redirectToDashboard();
  }
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function detectApiBase() {
  if (resolvedApiBase) {
    return resolvedApiBase;
  }
  if (!apiBasePromise) {
    apiBasePromise = (async () => {
      const fromStorage = localStorage.getItem(API_BASE_STORAGE_KEY) || "";
      const runtimeBase =
        typeof window !== "undefined" &&
        typeof window.LIFEFLOW_API_BASE === "string"
          ? window.LIFEFLOW_API_BASE
          : "";
      const localhostBase =
        window.location.hostname && window.location.hostname !== "localhost"
          ? "http://localhost:8787"
          : `${window.location.protocol}//${window.location.hostname || "localhost"}:8787`;
      const isLocalHost = ["localhost", "127.0.0.1"].includes(
        window.location.hostname,
      );
      const isStoredLocalhost =
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(fromStorage);
      const candidates = (
        isLocalHost
          ? [
              fromStorage,
              runtimeBase,
              localhostBase,
              "http://127.0.0.1:8787",
              DEFAULT_API_BASE,
            ]
          : [
              isStoredLocalhost ? "" : fromStorage,
              runtimeBase,
              DEFAULT_API_BASE,
              localhostBase,
              "http://127.0.0.1:8787",
            ]
      )
        .map((item) => String(item || "").trim())
        .filter(Boolean);

      const uniqueCandidates = [...new Set(candidates)];
      const [preferred, ...fallbacks] = uniqueCandidates;
      const probe = async (baseUrl) => {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), API_PROBE_TIMEOUT_MS);
        try {
          const response = await fetch(`${baseUrl.replace(/\/$/, "")}/health`, {
            credentials: "include",
            signal: controller.signal,
          });
          if (!response.ok) {
            throw new Error(`Healthcheck failed: ${response.status}`);
          }
          return baseUrl;
        } finally {
          window.clearTimeout(timeoutId);
        }
      };

      if (preferred) {
        try {
          resolvedApiBase = await probe(preferred);
          return resolvedApiBase;
        } catch (error) {
          // continue
        }
      }

      if (fallbacks.length) {
        try {
          resolvedApiBase = await Promise.any(fallbacks.map((baseUrl) => probe(baseUrl)));
          return resolvedApiBase;
        } catch (error) {
          // continue
        }
      }

      resolvedApiBase = DEFAULT_API_BASE;
      return resolvedApiBase;
    })().finally(() => {
      apiBasePromise = null;
    });
  }

  return apiBasePromise;
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
  if (authElements.captchaImage) {
    authElements.captchaImage.textContent = "加载中...";
  }
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
  const recoveryCode = String(formData.get("recoveryCode") || "").trim();
  const captchaText = String(formData.get("captchaText") || "").trim();

  if (!username || !password || !captchaText || (mode === "recover" && !recoveryCode)) {
    setFeedback(
      mode === "recover"
        ? "请填写用户名、新密码、恢复码和验证码。"
        : "请填写用户名、密码和验证码。",
    );
    return;
  }

  if (!captchaState.id) {
    setFeedback("验证码尚未准备好，请刷新后重试。");
    return;
  }

  setAuthMode(mode);
  saveAuthConfig({ username });
  setFeedback(
    mode === "signup"
      ? "正在创建账号..."
      : mode === "recover"
        ? "正在重置密码..."
        : "正在登录...",
  );

  try {
    const path =
      mode === "signup"
        ? "/api/auth/signup"
        : mode === "recover"
          ? "/api/auth/recover-password"
          : "/api/auth/signin";
    const payload = await fetchApiJson(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        mode === "recover"
          ? {
              username,
              newPassword: password,
              recoveryCode,
              captchaId: captchaState.id,
              captchaText,
            }
          : { username, password, captchaId: captchaState.id, captchaText },
      ),
    });
    if (payload?.session?.id) {
      saveSessionId(payload.session.id);
    }
    if (mode === "recover") {
      setFeedback("密码已重置，请保存新的恢复码。");
      openRecoveryCodeModal(payload?.recoveryCode || "", "stay");
      await refreshCaptcha();
      return;
    }
    if (payload?.recoveryCode) {
      setFeedback("创建成功，请先保存恢复码。");
      openRecoveryCodeModal(payload.recoveryCode, "redirect");
      return;
    }
    setFeedback("登录成功，正在进入 Dashboard...");
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
  if (action === "recover") {
    setAuthMode("recover");
    const recoveryValue = String(new FormData(authElements.form).get("recoveryCode") || "").trim();
    if (!recoveryValue) {
      setFeedback("已切换为恢复模式，请填写恢复码和新密码后再次提交。");
      authElements.form.elements.recoveryCode?.focus();
      return;
    }
  } else {
    setAuthMode(action);
  }
  void handlePasswordAuth(new FormData(authElements.form), action);
}

authElements.form.addEventListener("submit", handleLoginSubmit);
if (authElements.captchaImage) {
  authElements.captchaImage.addEventListener("click", () => {
    void refreshCaptcha();
  });
}
authElements.recoveryCodeConfirm?.addEventListener("click", closeRecoveryCodeModal);
setAuthMode("signin");
setFeedback(SIGNUP_REQUIREMENTS_TEXT);
void refreshCaptcha();
void bootstrapExistingSession();
