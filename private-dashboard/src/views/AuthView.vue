<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { AUTH_CHALLENGE_ENABLED } from "../app/constants";
import { fetchAuthChallenge, fetchCaptcha, recoverPassword, signIn, signUp } from "../services/auth-api";
import { loadApiBase, loadAuthConfig, refreshApiBase, saveAuthConfig } from "../services/config";
import { useSessionStore } from "../stores/session";
import { getUserFacingErrorMessage, isLikelyAbortError, isLikelyNetworkError } from "../utils/error-message";
import { loadTurnstileScript } from "../utils/turnstile";

const SIGNUP_REQUIREMENTS_TEXT =
  "创建账号要求：用户名 3-64 位且不能包含空格；密码 6-128 位。支持邮箱作为用户名。";

const route = useRoute();
const router = useRouter();
const sessionStore = useSessionStore();

const authMode = ref("signin");
const busy = ref(false);
const feedback = ref("");
const recoveryCodeModalOpen = ref(false);
const recoveryCodeValue = ref("");
const signupModalOpen = ref(false);
const pendingRedirect = ref(false);
const turnstileHostRef = ref(null);
const captcha = reactive({
  id: "",
  svg: "",
  loading: false,
});
const challenge = reactive({
  provider: "",
  turnstileSiteKey: "",
  turnstileToken: "",
  turnstileWidgetId: null,
  loading: false,
});
const form = reactive({
  username: loadAuthConfig().username,
  password: "",
  recoveryCode: "",
  captchaText: "",
});
const signupForm = reactive({
  username: loadAuthConfig().username,
  password: "",
});
const AUTH_CHALLENGE_TIMEOUT_MS = 30000;

const isRecoveryMode = computed(() => authMode.value === "recover");
const isFileProtocol = computed(() => typeof window !== "undefined" && window.location.protocol === "file:");
const isTurnstileMode = computed(() => challenge.provider === "turnstile");
const isLegacyCaptchaMode = computed(() => challenge.provider === "captcha");
const isChallengeDisabled = computed(() => !AUTH_CHALLENGE_ENABLED || challenge.provider === "none");
const isChallengeBusy = computed(() => challenge.loading || (isLegacyCaptchaMode.value && captcha.loading));
const isChallengeUnavailable = computed(
  () => !challenge.loading && !isTurnstileMode.value && !isLegacyCaptchaMode.value && !isChallengeDisabled.value,
);
const currentApiBase = computed(() => loadApiBase());

function resolveRedirectTarget() {
  const redirect = typeof route.query.redirect === "string" ? route.query.redirect : "/";
  if (!redirect.startsWith("/") || redirect.startsWith("//")) {
    return "/";
  }
  return redirect;
}

function setAuthMode(mode) {
  authMode.value = mode === "recover" ? "recover" : mode === "signup" ? "signup" : "signin";
}

function submitPrimaryAuth() {
  return submitAuth(isRecoveryMode.value ? "recover" : "signin");
}

function openSignupModal() {
  signupForm.username = String(form.username || "").trim();
  signupForm.password = "";
  signupModalOpen.value = true;
}

function closeSignupModal() {
  signupModalOpen.value = false;
  signupForm.password = "";
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function buildAuthErrorMessage(error, mode) {
  const message = getUserFacingErrorMessage(error, "").trim();
  if (message.includes("验证码错误或已过期") || message.includes("验证码校验失败")) {
    return "验证码错误、已过期或校验失败，请重新验证。";
  }
  if (message.includes("请先完成验证码验证")) {
    return "请先完成安全验证。";
  }
  if (message.includes("验证码服务暂时不可用")) {
    return "验证码服务暂时不可用，请稍后重试。";
  }
  if (mode === "recover") {
    if (message.includes("恢复码错误")) {
      return "恢复码错误，请检查后重试。";
    }
    return message ? `重置失败：${message}` : "重置失败，请检查恢复码和新密码。";
  }
  if (mode === "signup") {
    if (message.includes("用户名已存在")) {
      return "创建账号失败：该用户名已存在。";
    }
    return message ? `创建账号失败：${message}` : `创建账号失败。${SIGNUP_REQUIREMENTS_TEXT}`;
  }
  return message ? `登录失败：${message}` : "登录失败，请检查用户名和密码。";
}

function buildCaptchaErrorMessage(error, fallbackMessage = "验证码加载失败，请刷新后重试。") {
  const message = String(error?.message || "").trim();
  if (isLikelyAbortError(error)) {
    return "验证码加载超时。Render 免费实例首次唤醒可能需要 20-50 秒，请稍后重试。";
  }
  if (isLikelyNetworkError(error)) {
    return "认证服务连接失败。系统已重新探测服务地址，请确认本地后端已启动后再试。";
  }
  if (message) {
    return `验证码加载失败：${message}`;
  }
  return fallbackMessage;
}

async function refetchAuthChallengeAfterApiRefresh(timeoutMs = AUTH_CHALLENGE_TIMEOUT_MS) {
  await refreshApiBase();
  return fetchAuthChallenge(timeoutMs);
}

async function refreshCaptcha(options = {}) {
  const silent = Boolean(options.silent);
  captcha.loading = true;
  try {
    let payload = null;
    let lastError = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        payload = await fetchCaptcha();
        break;
      } catch (error) {
        lastError = error;
        if (attempt === 0) {
          await wait(1200);
        }
      }
    }

    if (!payload?.captcha?.id || !payload?.captcha?.svg) {
      throw lastError || new Error("Captcha payload missing");
    }

    captcha.id = payload?.captcha?.id || "";
    captcha.svg = payload?.captcha?.svg || "";
    form.captchaText = "";
    if (!silent && (feedback.value.startsWith("验证码") || feedback.value.includes("认证服务"))) {
      feedback.value = "";
    }
  } catch (error) {
    captcha.id = "";
    captcha.svg = "";
    if (!silent) {
      feedback.value = buildCaptchaErrorMessage(error);
    }
  } finally {
    captcha.loading = false;
  }
}

function clearTurnstileToken() {
  challenge.turnstileToken = "";
}

function resetTurnstileWidget() {
  if (!isTurnstileMode.value || challenge.turnstileWidgetId == null || !window.turnstile) {
    clearTurnstileToken();
    return;
  }
  clearTurnstileToken();
  window.turnstile.reset(challenge.turnstileWidgetId);
}

function teardownTurnstileWidget() {
  clearTurnstileToken();
  if (window.turnstile && challenge.turnstileWidgetId != null && typeof window.turnstile.remove === "function") {
    window.turnstile.remove(challenge.turnstileWidgetId);
  }
  challenge.turnstileWidgetId = null;
  if (turnstileHostRef.value) {
    turnstileHostRef.value.innerHTML = "";
  }
}

async function renderTurnstileWidget() {
  if (!isTurnstileMode.value || !challenge.turnstileSiteKey) {
    return;
  }
  await loadTurnstileScript();
  await nextTick();
  if (!turnstileHostRef.value || !window.turnstile) {
    throw new Error("Turnstile widget mount point is not ready");
  }
  teardownTurnstileWidget();
  challenge.turnstileWidgetId = window.turnstile.render(turnstileHostRef.value, {
    sitekey: challenge.turnstileSiteKey,
    theme: "auto",
    callback(token) {
      challenge.turnstileToken = String(token || "");
    },
    "expired-callback"() {
      clearTurnstileToken();
      feedback.value = "安全验证已过期，请重新完成验证。";
    },
    "error-callback"() {
      clearTurnstileToken();
      feedback.value = "安全验证加载失败，请稍后重试。";
    },
  });
}

async function loadAuthChallengeConfig(options = {}) {
  if (!AUTH_CHALLENGE_ENABLED) {
    challenge.provider = "none";
    challenge.turnstileSiteKey = "";
    challenge.loading = false;
    teardownTurnstileWidget();
    captcha.id = "";
    captcha.svg = "";
    form.captchaText = "";
    return;
  }

  const silent = Boolean(options.silent);
  challenge.loading = true;

  try {
    let payload = null;
    let lastError = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        payload = await fetchAuthChallenge(AUTH_CHALLENGE_TIMEOUT_MS);
        break;
      } catch (error) {
        lastError = error;
        if (error?.status === 404) {
          break;
        }
        if (attempt < 2) {
          await wait(1600 + attempt * 900);
        }
      }
    }

    if (!payload && lastError && isLikelyNetworkError(lastError)) {
      try {
        payload = await refetchAuthChallengeAfterApiRefresh(AUTH_CHALLENGE_TIMEOUT_MS);
        lastError = null;
      } catch (error) {
        lastError = error;
      }
    }

    if (!payload?.challenge) {
      throw lastError || new Error("Auth challenge payload missing");
    }

    const nextProvider =
      payload?.challenge?.provider === "none"
        ? "none"
        : payload?.challenge?.provider === "turnstile" && payload?.challenge?.turnstileSiteKey
          ? "turnstile"
          : "captcha";

    challenge.provider = nextProvider;
    challenge.turnstileSiteKey = String(payload?.challenge?.turnstileSiteKey || "");

    if (nextProvider === "none") {
      teardownTurnstileWidget();
      captcha.id = "";
      captcha.svg = "";
      form.captchaText = "";
      challenge.loading = false;
      if (!silent && feedback.value.startsWith("验证码")) {
        feedback.value = SIGNUP_REQUIREMENTS_TEXT;
      }
      return;
    }

    if (nextProvider === "turnstile") {
      captcha.id = "";
      captcha.svg = "";
      form.captchaText = "";
      challenge.loading = false;
      await renderTurnstileWidget();
      if (!silent && (feedback.value.startsWith("验证码") || feedback.value.includes("认证服务"))) {
        feedback.value = "";
      }
      return;
    }

    challenge.loading = false;
    await refreshCaptcha({ silent: true });
    if (!silent && (feedback.value.startsWith("验证码") || feedback.value.includes("认证服务"))) {
      feedback.value = "";
    }
  } catch (error) {
    challenge.provider = "";
    challenge.turnstileSiteKey = "";
    teardownTurnstileWidget();
    captcha.id = "";
    captcha.svg = "";
    if (!silent) {
      feedback.value = buildCaptchaErrorMessage(
        error,
        "认证服务暂时不可用。系统已尝试重新连接，请稍后重试。",
      );
    }
  } finally {
    if (challenge.loading) {
      challenge.loading = false;
    }
  }
}

async function refreshAuthChallenge(options = {}) {
  if (challenge.loading) {
    return;
  }

  if (isTurnstileMode.value) {
    if (challenge.turnstileWidgetId == null) {
      await renderTurnstileWidget();
      return;
    }
    resetTurnstileWidget();
    return;
  }

  if (isLegacyCaptchaMode.value) {
    await refreshCaptcha(options);
    return;
  }

  await loadAuthChallengeConfig(options);
}

function buildChallengePayload() {
  if (isChallengeDisabled.value) {
    return {};
  }

  if (isTurnstileMode.value) {
    return {
      turnstileToken: String(challenge.turnstileToken || ""),
    };
  }

  return {
    captchaId: captcha.id,
    captchaText: String(form.captchaText || "").trim(),
  };
}

async function closeRecoveryCodeModal() {
  recoveryCodeModalOpen.value = false;
  recoveryCodeValue.value = "";
  const shouldRedirect = pendingRedirect.value;
  pendingRedirect.value = false;
  if (shouldRedirect) {
    await router.replace(resolveRedirectTarget());
  }
}

async function submitAuth(mode = "signin") {
  const username = String(form.username || "").trim();
  const password = String(form.password || "");
  const recoveryCode = String(form.recoveryCode || "").trim();

  if (mode === "recover" && !recoveryCode) {
    setAuthMode("recover");
    feedback.value = "已切换为恢复模式，请填写恢复码和新密码后再次提交。";
    return;
  }

  if (!username || !password || (mode === "recover" && !recoveryCode)) {
    feedback.value =
      mode === "recover"
        ? "请填写用户名、新密码和恢复码。"
        : "请填写用户名和密码。";
    return;
  }

  if (isChallengeBusy.value || isChallengeUnavailable.value) {
    feedback.value = "认证服务尚未就绪，请稍后重试。";
    return;
  }

  if (isTurnstileMode.value && !challenge.turnstileToken) {
    feedback.value = "请先完成安全验证。";
    return;
  }

  if (isLegacyCaptchaMode.value && (!captcha.id || !String(form.captchaText || "").trim())) {
    feedback.value = "验证码尚未准备好，请刷新后重试。";
    return;
  }

  busy.value = true;
  setAuthMode(mode);
  saveAuthConfig({ username });
  feedback.value =
    mode === "signup" ? "正在创建账号..." : mode === "recover" ? "正在重置密码..." : "正在登录...";

  try {
    const payload = await (
      mode === "signup"
        ? signUp({
            username,
            password,
            ...buildChallengePayload(),
          })
        : mode === "recover"
          ? recoverPassword({
              username,
              newPassword: password,
              recoveryCode,
              ...buildChallengePayload(),
            })
          : signIn({
              username,
              password,
              ...buildChallengePayload(),
            })
    );

    if (mode === "recover") {
      setAuthMode("signin");
      form.password = "";
      form.recoveryCode = "";
      feedback.value = "密码已重置，请保存新的恢复码。";
      recoveryCodeValue.value = payload?.recoveryCode || "";
      recoveryCodeModalOpen.value = true;
      pendingRedirect.value = false;
      await refreshAuthChallenge({ silent: true });
      return;
    }

    sessionStore.applySession(payload, mode === "signup" ? "创建成功，正在进入 Today..." : "登录成功，正在进入 Today...");

    if (payload?.recoveryCode) {
      feedback.value = "创建成功，请先保存恢复码。";
      recoveryCodeValue.value = payload.recoveryCode;
      recoveryCodeModalOpen.value = true;
      pendingRedirect.value = true;
      return;
    }

    feedback.value = "登录成功，正在进入 Today...";
    await wait(300);
    await router.replace(resolveRedirectTarget());
  } catch (error) {
    feedback.value = buildAuthErrorMessage(error, mode);
    await refreshAuthChallenge({ silent: true });
  } finally {
    busy.value = false;
  }
}

async function submitSignup() {
  const username = String(signupForm.username || "").trim();
  const password = String(signupForm.password || "");

  if (!username || !password) {
    feedback.value = "请填写创建账号所需的用户名和密码。";
    return;
  }

  if (isChallengeBusy.value || isChallengeUnavailable.value) {
    feedback.value = "认证服务尚未就绪，请稍后重试。";
    return;
  }

  if (isTurnstileMode.value && !challenge.turnstileToken) {
    feedback.value = "请先完成安全验证。";
    return;
  }

  if (isLegacyCaptchaMode.value && (!captcha.id || !String(form.captchaText || "").trim())) {
    feedback.value = "验证码尚未准备好，请刷新后重试。";
    return;
  }

  busy.value = true;
  setAuthMode("signup");
  saveAuthConfig({ username });
  feedback.value = "正在创建账号...";

  try {
    const payload = await signUp({
      username,
      password,
      ...buildChallengePayload(),
    });

    form.username = username;
    sessionStore.applySession(payload, "创建成功，正在进入 Today...");

    if (payload?.recoveryCode) {
      closeSignupModal();
      feedback.value = "创建成功，请先保存恢复码。";
      recoveryCodeValue.value = payload.recoveryCode;
      recoveryCodeModalOpen.value = true;
      pendingRedirect.value = true;
      return;
    }

    closeSignupModal();
    feedback.value = "创建成功，正在进入 Today...";
    await wait(300);
    await router.replace(resolveRedirectTarget());
  } catch (error) {
    feedback.value = buildAuthErrorMessage(error, "signup");
    await refreshAuthChallenge({ silent: true });
  } finally {
    busy.value = false;
  }
}

onMounted(async () => {
  await loadAuthChallengeConfig();
});

onBeforeUnmount(() => {
  teardownTurnstileWidget();
});
</script>

<template>
  <main class="auth-page-shell">
    <section class="auth-gate-card" aria-labelledby="login-page-title">
      <p class="panel-kicker">Cloud Sync</p>
      <h1 id="login-page-title">登录后同步到云端</h1>
      <p class="auth-gate-copy">
        登录后你的任务、备注和周总结会接入现有后端。首次使用可先创建账号，并妥善保存系统生成的恢复码；如果忘记密码，可用恢复码重置。
      </p>

      <div v-if="isFileProtocol" class="auth-inline-note">
        当前页面是通过 <code>file://</code> 打开的。正式使用请改用本地或部署后的 HTTP 地址访问。
      </div>

      <form class="auth-gate-form" @submit.prevent="submitPrimaryAuth">
        <label class="auth-field">
          <span class="auth-field-label">用户名</span>
          <input
            v-model="form.username"
            type="text"
            placeholder="输入用户名"
            autocomplete="username"
            required
          />
        </label>

        <label class="auth-field">
          <span class="auth-field-label">{{ isRecoveryMode ? "新密码" : "密码" }}</span>
          <input
            v-model="form.password"
            type="password"
            :placeholder="isRecoveryMode ? '输入新的登录密码' : '输入你的密码'"
            :autocomplete="isRecoveryMode ? 'new-password' : 'current-password'"
            required
          />
        </label>

        <label v-if="isRecoveryMode" class="auth-field">
          <span class="auth-field-label">恢复码</span>
          <input
            v-model="form.recoveryCode"
            type="text"
            placeholder="输入形如 ABCD-EFGH-IJKL-MNOP 的恢复码"
            autocomplete="off"
            spellcheck="false"
          />
        </label>

        <div v-if="!isChallengeDisabled" class="auth-field captcha-field">
          <span class="auth-field-label">{{ isTurnstileMode ? "安全验证" : "验证码" }}</span>

          <div v-if="challenge.loading" class="captcha-status-card">
            正在唤醒认证服务，Render 免费实例首次请求可能需要 20-50 秒。
          </div>

          <div v-else-if="isTurnstileMode" class="captcha-turnstile-shell">
            <div ref="turnstileHostRef" class="turnstile-host"></div>
            <div class="captcha-help-row">
              <span class="settings-copy">
                {{ challenge.turnstileToken ? "验证已完成，可继续提交。" : "请先完成上方安全验证。" }}
              </span>
              <button type="button" class="task-cancel-action" @click="refreshAuthChallenge">
                重新加载验证
              </button>
            </div>
          </div>

          <div v-else-if="isLegacyCaptchaMode && captcha.loading" class="captcha-status-card">
            正在加载验证码，请稍候。
          </div>

          <div v-else-if="isLegacyCaptchaMode && captcha.svg" class="captcha-row">
            <button
              type="button"
              class="captcha-image"
              :aria-label="captcha.loading ? '验证码加载中' : '点击刷新验证码'"
              :title="captcha.loading ? '验证码加载中' : '点击刷新验证码'"
              @click="refreshCaptcha"
            >
              <span v-if="captcha.loading">加载中...</span>
              <span v-else-if="!captcha.svg">加载失败</span>
              <span v-else v-html="captcha.svg"></span>
            </button>
            <input
              v-model="form.captchaText"
              type="text"
              placeholder="输入图形验证码"
              autocomplete="off"
              spellcheck="false"
              required
            />
          </div>

          <div v-else-if="isLegacyCaptchaMode" class="captcha-status-card is-error">
            <span>验证码加载失败，请重试。</span>
            <button type="button" class="task-cancel-action" @click="refreshCaptcha">
              重新加载验证码
            </button>
          </div>

          <div v-else class="captcha-status-card is-error">
            <span>{{ currentApiBase ? `认证服务暂时不可用 · ${currentApiBase}` : "认证服务暂时不可用。" }}</span>
            <button type="button" class="task-cancel-action" @click="loadAuthChallengeConfig">
              重试连接
            </button>
          </div>
        </div>

        <p class="auth-feedback">{{ feedback }}</p>

        <div class="auth-gate-actions">
          <button type="submit" class="settings-save auth-login-button" :disabled="busy || (!isChallengeDisabled && isChallengeBusy)">
            {{ busy && isRecoveryMode ? "重置中..." : busy && authMode === "signin" ? "登录中..." : isRecoveryMode ? "重置密码" : "登录" }}
          </button>
          <button type="button" class="auth-button" :disabled="busy" @click="openSignupModal">
            创建账号
          </button>
          <button type="button" class="auth-button auth-recover-action" :disabled="busy || (!isChallengeDisabled && isChallengeBusy)" @click="submitAuth('recover')">
            {{ busy && authMode === "recover" ? "重置中..." : "重置密码" }}
          </button>
        </div>

      </form>
    </section>

    <div class="settings-modal" :hidden="!signupModalOpen">
      <div class="settings-backdrop" @click="closeSignupModal"></div>
      <section class="settings-dialog auth-recovery-dialog" role="dialog" aria-modal="true" aria-labelledby="signup-modal-title">
        <div class="settings-header">
          <div>
            <p class="panel-kicker">Create Account</p>
            <h2 id="signup-modal-title">创建账号</h2>
          </div>
          <button type="button" class="modal-close" aria-label="关闭弹窗" @click="closeSignupModal">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <p class="auth-gate-copy">{{ SIGNUP_REQUIREMENTS_TEXT }}</p>
        <div class="auth-gate-form" style="margin-top: 14px;">
          <label class="auth-field">
            <span class="auth-field-label">用户名</span>
            <input
              v-model="signupForm.username"
              type="text"
              placeholder="输入用户名"
              autocomplete="username"
            />
          </label>

          <label class="auth-field">
            <span class="auth-field-label">密码</span>
            <input
              v-model="signupForm.password"
              type="password"
              placeholder="输入新的登录密码"
              autocomplete="new-password"
            />
          </label>
        </div>
        <div class="auth-dialog-actions" style="justify-content: space-between; gap: 10px; flex-wrap: wrap;">
          <button type="button" class="task-cancel-action" @click="closeSignupModal">取消</button>
          <button type="button" class="settings-save" :disabled="busy || (!isChallengeDisabled && isChallengeBusy)" @click="submitSignup">
            {{ busy && authMode === "signup" ? "创建中..." : "确认创建" }}
          </button>
        </div>
      </section>
    </div>

    <div class="settings-modal" :hidden="!recoveryCodeModalOpen">
      <div class="settings-backdrop" @click="closeRecoveryCodeModal"></div>
      <section class="settings-dialog auth-recovery-dialog" role="dialog" aria-modal="true" aria-labelledby="recovery-code-title">
        <div class="settings-header">
          <div>
            <p class="panel-kicker">Recovery Code</p>
            <h2 id="recovery-code-title">请保存你的恢复码</h2>
          </div>
          <button type="button" class="modal-close" aria-label="关闭弹窗" @click="closeRecoveryCodeModal">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <p class="auth-gate-copy">
          这个恢复码只会展示这一次。忘记密码时，可用它配合验证码重置密码。
        </p>
        <pre class="auth-recovery-code mono">{{ recoveryCodeValue }}</pre>
        <div class="auth-dialog-actions">
          <button type="button" class="settings-save" @click="closeRecoveryCodeModal">我已保存</button>
        </div>
      </section>
    </div>
  </main>
</template>
