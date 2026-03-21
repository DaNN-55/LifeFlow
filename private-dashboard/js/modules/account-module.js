export function createAccountModule(deps) {
  const {
    state,
    elements,
    escapeHtml,
    formatDateTime,
    getSidebarPreferences,
    applyAccountPreferences,
    fetchApiJson,
    fetchAuthSession,
    persistStateSilently,
    saveSessionId,
    loadSessionId,
    saveAccountPreferencesRemote,
    saveAuthConfig,
    switchDataScope,
    bootstrapRemoteData,
    signOutAuth,
    resetCurrentAccountLocalState,
    setAppVisibility,
    showAppBootOverlay,
    hideAppBootOverlay,
    render,
    renderControls,
    renderWidgets,
    refreshGitHubRepo,
    setSaveStatus,
  } = deps;

  function getPreferencesWithoutTheme(preferences) {
    if (!preferences || typeof preferences !== "object") {
      return preferences;
    }
    return {
      ...preferences,
      theme: undefined,
    };
  }

  function renderAccountMenu() {
    if (!elements.accountMenu) {
      return;
    }
    const shouldShow = Boolean(state.auth.user && state.accountMenuOpen);
    elements.accountMenu.hidden = !shouldShow;
  }

  function renderAccountProfileModal() {
    const modal = elements.accountProfileModal;
    if (!modal) {
      return;
    }
    if (!state.accountProfileModalOpen) {
      modal.hidden = true;
      return;
    }
    modal.hidden = false;
    if (state.accountProfileLoading) {
      elements.accountProfileBody.innerHTML =
        '<div class="delete-task-dialog-copy">正在加载账号资料...</div>';
      return;
    }
    const profile = state.accountProfile;
    if (!profile?.user) {
      elements.accountProfileBody.innerHTML =
        '<div class="delete-task-dialog-copy">暂时无法读取当前账号资料。</div>';
      return;
    }
    const createdAt = profile.user.createdAt
      ? formatDateTime(profile.user.createdAt)
      : "--";
    const sidebar = getSidebarPreferences();
    const birthDate = String(state.data.preferences?.profile?.birthDate || "1996-11-05").trim();
    const lifeExpectancyYears = Number(state.data.preferences?.profile?.lifeExpectancyYears) || 80;
    elements.accountProfileBody.innerHTML = `
      <div class="account-profile-grid">
        <div class="account-profile-item">
          <span class="account-profile-label">用户名</span>
          <strong>${escapeHtml(profile.user.username || "--")}</strong>
        </div>
        <div class="account-profile-item">
          <span class="account-profile-label">创建时间</span>
          <strong>${escapeHtml(createdAt)}</strong>
        </div>
      </div>
      <div class="account-profile-stats">
        <div class="account-profile-stat">
          <span>任务数</span>
          <strong>${Number(profile.counts?.tasks || 0)}</strong>
        </div>
        <div class="account-profile-stat">
          <span>每日记录</span>
          <strong>${Number(profile.counts?.dailyRecords || 0)}</strong>
        </div>
        <div class="account-profile-stat">
          <span>周总结</span>
          <strong>${Number(profile.counts?.weeklySummaries || 0)}</strong>
        </div>
      </div>
      <form id="account-preferences-form" class="account-form account-preferences-form">
        <div class="account-profile-item">
          <span class="account-profile-label">面板开关</span>
          <div class="account-card-toggle-list">
            <div class="account-card-toggle-column">
              <label class="account-card-toggle">
                <span>日历</span>
                <span class="account-toggle-switch">
                  <input type="checkbox" name="calendar" ${sidebar.calendar ? "checked" : ""} />
                  <span class="account-toggle-track"></span>
                </span>
              </label>
              <label class="account-card-toggle">
                <span>GitHub</span>
                <span class="account-toggle-switch">
                  <input type="checkbox" name="github" ${sidebar.github ? "checked" : ""} />
                  <span class="account-toggle-track"></span>
                </span>
              </label>
              <label class="account-card-toggle">
                <span>Finance</span>
                <span class="account-toggle-switch">
                  <input type="checkbox" name="financeFeed" ${sidebar.financeFeed ? "checked" : ""} />
                  <span class="account-toggle-track"></span>
                </span>
              </label>
              <label class="account-card-toggle">
                <span>Science</span>
                <span class="account-toggle-switch">
                  <input type="checkbox" name="scienceFeed" ${sidebar.scienceFeed ? "checked" : ""} />
                  <span class="account-toggle-track"></span>
                </span>
              </label>
            </div>
            <div class="account-card-toggle-column">
              <label class="account-card-toggle">
                <span>天气</span>
                <span class="account-toggle-switch">
                  <input type="checkbox" name="weather" ${sidebar.weather ? "checked" : ""} />
                  <span class="account-toggle-track"></span>
                </span>
              </label>
              <label class="account-card-toggle">
                <span>股票</span>
                <span class="account-toggle-switch">
                  <input type="checkbox" name="stock" ${sidebar.stock ? "checked" : ""} />
                  <span class="account-toggle-track"></span>
                </span>
              </label>
              <label class="account-card-toggle">
                <span>Favorites</span>
                <span class="account-toggle-switch">
                  <input type="checkbox" name="favorites" ${sidebar.favorites ? "checked" : ""} />
                  <span class="account-toggle-track"></span>
                </span>
              </label>
            </div>
          </div>
        </div>
        <div class="account-profile-item">
          <span class="account-profile-label">人生进度</span>
          <div class="settings-grid-two">
            <label>
              <span class="settings-copy">出生日期</span>
              <input type="date" name="birthDate" value="${escapeHtml(birthDate)}" />
            </label>
            <label>
              <span class="settings-copy">默认寿命</span>
              <input type="number" name="lifeExpectancyYears" min="1" max="150" value="${lifeExpectancyYears}" />
            </label>
          </div>
        </div>
        <div class="delete-task-dialog-actions">
          <button type="submit" class="settings-save">保存面板设置</button>
        </div>
      </form>
      <form id="account-recovery-code-form" class="account-form">
        <div class="account-profile-item">
          <span class="account-profile-label">密码找回</span>
          <p class="settings-copy">恢复码仅展示一次。请保存在安全位置，忘记密码时可在登录页配合验证码重置。</p>
          ${
            state.accountRecoveryFeedback
              ? `<p class="settings-copy">${escapeHtml(state.accountRecoveryFeedback)}</p>`
              : ""
          }
          ${
            state.accountRecoveryCode
              ? `<pre class="delete-task-dialog-copy mono">${escapeHtml(state.accountRecoveryCode)}</pre>`
              : ""
          }
        </div>
        <div class="delete-task-dialog-actions">
          <button type="submit" class="task-cancel-action" ${state.accountRecoveryCodeBusy ? "disabled" : ""}>
            ${state.accountRecoveryCodeBusy ? "生成中..." : "生成新的恢复码"}
          </button>
        </div>
      </form>
    `;
  }

  function renderChangePasswordModal() {
    const modal = elements.changePasswordModal;
    if (!modal) {
      return;
    }
    modal.hidden = !state.changePasswordModalOpen;
    if (!modal.hidden) {
      elements.changePasswordFeedback.textContent =
        state.auth.feedback || "修改后请使用新密码登录。";
      const submit = document.querySelector("#change-password-submit");
      if (submit) {
        submit.disabled = state.changePasswordSubmitting;
        submit.textContent = state.changePasswordSubmitting ? "保存中..." : "保存密码";
      }
    }
  }

  async function loadAccountProfile() {
    if (!state.auth.user) {
      return;
    }
    state.accountProfileLoading = true;
    renderAccountProfileModal();
    try {
      const payload = await fetchApiJson("/api/account/profile");
      if (payload?.user?.preferences) {
        applyAccountPreferences(getPreferencesWithoutTheme(payload.user.preferences), {
          applyTheme: false,
        });
      }
      state.accountProfile = {
        user: payload.user || null,
        counts: payload.counts || {},
      };
    } catch (error) {
      console.warn("Failed to load account profile.", error);
      state.accountProfile = null;
    } finally {
      state.accountProfileLoading = false;
      renderAccountProfileModal();
    }
  }

  function openAccountMenu() {
    if (!state.auth.user) {
      return;
    }
    state.accountMenuOpen = true;
    renderControls();
  }

  function closeAccountMenu() {
    state.accountMenuOpen = false;
    renderControls();
  }

  function toggleAccountMenu() {
    if (!state.auth.user) {
      return;
    }
    state.accountMenuOpen = !state.accountMenuOpen;
    renderControls();
  }

  function openAccountProfileModal() {
    closeAccountMenu();
    state.accountProfileModalOpen = true;
    state.accountProfile = null;
    state.accountRecoveryCode = "";
    state.accountRecoveryCodeBusy = false;
    state.accountRecoveryFeedback = "";
    renderAccountProfileModal();
    void loadAccountProfile();
  }

  function closeAccountProfileModal() {
    state.accountProfileModalOpen = false;
    state.accountRecoveryCode = "";
    state.accountRecoveryCodeBusy = false;
    state.accountRecoveryFeedback = "";
    renderAccountProfileModal();
  }

  async function handleAccountProfilePreferencesSubmit(event) {
    const form = event.target.closest("#account-preferences-form");
    if (!form) {
      return;
    }
    event.preventDefault();
    const formData = new FormData(form);
    state.data.preferences.sidebar = {
      calendar: formData.has("calendar"),
      github: formData.has("github"),
      financeFeed: formData.has("financeFeed"),
      scienceFeed: formData.has("scienceFeed"),
      favorites: formData.has("favorites"),
      weather: formData.has("weather"),
      stock: formData.has("stock"),
    };
    state.data.preferences.profile = {
      birthDate: String(formData.get("birthDate") || "").trim(),
      lifeExpectancyYears: Math.min(
        150,
        Math.max(1, Number(formData.get("lifeExpectancyYears") || 80) || 80),
      ),
    };
    persistStateSilently();
    if (state.auth.user) {
      try {
        await saveAccountPreferencesRemote();
      } catch (error) {
        console.warn("Failed to save account preferences remotely.", error);
        setSaveStatus("面板设置已保存在本地，云端同步稍后重试");
      }
    }
    render();
    renderAccountProfileModal();
    if (state.data.preferences.sidebar.github) {
      await refreshGitHubRepo();
      renderWidgets();
    }
    setSaveStatus("已保存账号面板设置", "success");
  }

  async function handleAccountRecoveryCodeSubmit(event) {
    const form = event.target.closest("#account-recovery-code-form");
    if (!form || !state.auth.user) {
      return;
    }
    event.preventDefault();
    state.accountRecoveryCodeBusy = true;
    state.accountRecoveryFeedback = "正在生成新的恢复码...";
    renderAccountProfileModal();
    try {
      const payload = await fetchApiJson("/api/account/recovery-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      state.accountRecoveryCode = payload?.recoveryCode || "";
      state.accountRecoveryCodeBusy = false;
      state.accountRecoveryFeedback = state.accountRecoveryCode
        ? "新的恢复码已生成，请立即保存。"
        : "恢复码已更新。";
      renderAccountProfileModal();
      setSaveStatus("新的恢复码已生成，请立即保存", "success");
    } catch (error) {
      console.warn("Failed to generate recovery code.", error);
      state.accountRecoveryCodeBusy = false;
      state.accountRecoveryFeedback = error?.message || "生成恢复码失败";
      renderAccountProfileModal();
      setSaveStatus(error?.message || "生成恢复码失败");
    }
  }

  function openChangePasswordModal() {
    closeAccountMenu();
    state.changePasswordModalOpen = true;
    state.auth.feedback = "";
    elements.changePasswordForm?.reset();
    renderChangePasswordModal();
  }

  function closeChangePasswordModal() {
    state.changePasswordModalOpen = false;
    state.changePasswordSubmitting = false;
    state.auth.feedback = "";
    renderChangePasswordModal();
  }

  async function initAuthClient() {
    state.auth.status = "authenticating";
    showAppBootOverlay({
      title: "正在进入 Dashboard",
      detail: "正在验证登录状态并连接云端数据...",
      actionsVisible: false,
    });
    renderControls();

    try {
      const payload = await fetchAuthSessionWithRetry();
      state.auth.user = payload.user || null;
      saveSessionId(payload?.session?.id || loadSessionId());
      if (state.auth.user?.id) {
        switchDataScope(state.auth.user.id);
        if (payload?.user?.preferences) {
          applyAccountPreferences(getPreferencesWithoutTheme(payload.user.preferences), {
            applyTheme: false,
          });
        }
      }
      state.auth.status = state.auth.user ? "ready" : "idle";
      state.auth.feedback = state.auth.user
        ? `已登录 ${state.auth.user.username}`
        : "请先登录你的账号。";

      if (!state.auth.user) {
        saveSessionId("");
        window.location.replace("./login.html");
        return null;
      }

      renderControls();
      void bootstrapRemoteData();
      return state.auth.user;
    } catch (error) {
      const hasStoredSession = Boolean(loadSessionId());
      state.auth.user = null;
      state.auth.status = "idle";
      state.auth.feedback = hasStoredSession
        ? "会话验证失败，请重试连接。"
        : "请先登录你的账号。";
      if (!hasStoredSession) {
        saveSessionId("");
      }
      renderControls();
      if (hasStoredSession) {
        showAppBootOverlay({
          title: "云端连接超时",
          detail: "已保留当前登录会话。你可以重试连接，或返回登录页重新进入。",
          actionsVisible: true,
        });
        return null;
      }
      window.location.replace("./login.html");
      return null;
    }
  }

  async function fetchAuthSessionWithRetry() {
    let lastError = null;
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const payload = await fetchAuthSession();
        if (payload?.user || !loadSessionId()) {
          return payload;
        }
        lastError = new Error("Session not ready");
      } catch (error) {
        lastError = error;
      }
      if (attempt < maxAttempts) {
        showAppBootOverlay({
          title: "正在连接云端",
          detail: `正在验证登录状态（第 ${attempt + 1} 次尝试）... 单次请求最长等待约 3.5 秒。`,
          actionsVisible: false,
        });
        await new Promise((resolve) => window.setTimeout(resolve, attempt * 500));
      }
    }
    throw lastError || new Error("Authentication bootstrap failed");
  }

  async function handleChangePasswordSubmit(event) {
    if (event.target !== elements.changePasswordForm) {
      return;
    }
    event.preventDefault();
    const formData = new FormData(elements.changePasswordForm);
    const currentPassword = String(formData.get("currentPassword") || "");
    const newPassword = String(formData.get("newPassword") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");
    if (!currentPassword || !newPassword || !confirmPassword) {
      state.auth.feedback = "请完整填写密码信息。";
      renderChangePasswordModal();
      return;
    }
    if (newPassword !== confirmPassword) {
      state.auth.feedback = "两次输入的新密码不一致。";
      renderChangePasswordModal();
      return;
    }
    state.changePasswordSubmitting = true;
    state.auth.feedback = "正在更新密码...";
    renderChangePasswordModal();
    try {
      await fetchApiJson("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setSaveStatus("密码已更新", "success");
      closeChangePasswordModal();
    } catch (error) {
      console.warn("Failed to change password.", error);
      state.auth.feedback = error?.message || "修改密码失败";
      state.changePasswordSubmitting = false;
      renderChangePasswordModal();
    }
  }

  function handleAuthAction() {
    closeAccountMenu();
    if (state.auth.user) {
      void signOutAuth();
      return;
    }
    window.location.href = "./login.html";
  }

  return {
    renderAccountMenu,
    renderAccountProfileModal,
    renderChangePasswordModal,
    loadAccountProfile,
    openAccountMenu,
    closeAccountMenu,
    toggleAccountMenu,
    openAccountProfileModal,
    closeAccountProfileModal,
    handleAccountProfilePreferencesSubmit,
    handleAccountRecoveryCodeSubmit,
    openChangePasswordModal,
    closeChangePasswordModal,
    initAuthClient,
    handleChangePasswordSubmit,
    handleAuthAction,
  };
}
