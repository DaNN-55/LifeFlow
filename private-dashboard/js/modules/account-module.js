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
        <div class="delete-task-dialog-actions">
          <button type="submit" class="settings-save">保存面板设置</button>
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

  function renderClearAccountDataModal() {
    const modal = elements.clearAccountDataModal;
    if (!modal) {
      return;
    }
    modal.hidden = !state.clearAccountDataModalOpen;
    elements.clearAccountDataConfirm.disabled = state.clearAccountDataSubmitting;
    elements.clearAccountDataConfirm.textContent = state.clearAccountDataSubmitting
      ? "清空中..."
      : "确认清空";
  }

  function renderDeleteAccountModal() {
    const modal = elements.deleteAccountModal;
    if (!modal) {
      return;
    }
    modal.hidden = !state.deleteAccountModalOpen;
    if (!modal.hidden) {
      elements.deleteAccountFeedback.textContent =
        state.auth.feedback || "删除账号前，请先输入当前密码确认。";
      const submit = document.querySelector("#delete-account-submit");
      if (submit) {
        submit.disabled = state.deleteAccountSubmitting;
        submit.textContent = state.deleteAccountSubmitting ? "删除中..." : "删除账号";
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
    renderAccountProfileModal();
    void loadAccountProfile();
  }

  function closeAccountProfileModal() {
    state.accountProfileModalOpen = false;
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

  function openClearAccountDataModal() {
    closeAccountMenu();
    state.clearAccountDataModalOpen = true;
    renderClearAccountDataModal();
  }

  function closeClearAccountDataModal() {
    state.clearAccountDataModalOpen = false;
    state.clearAccountDataSubmitting = false;
    renderClearAccountDataModal();
  }

  function openDeleteAccountModal() {
    closeAccountMenu();
    state.deleteAccountModalOpen = true;
    state.auth.feedback = "";
    elements.deleteAccountForm?.reset();
    renderDeleteAccountModal();
  }

  function closeDeleteAccountModal() {
    state.deleteAccountModalOpen = false;
    state.deleteAccountSubmitting = false;
    state.auth.feedback = "";
    renderDeleteAccountModal();
  }

  async function initAuthClient() {
    state.auth.status = "authenticating";
    renderControls();

    try {
      const payload = await fetchAuthSession();
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
        window.location.href = "./login.html";
        return null;
      }

      renderControls();
      setAppVisibility(true);
      void bootstrapRemoteData();
      return state.auth.user;
    } catch (error) {
      state.auth.user = null;
      state.auth.status = "idle";
      state.auth.feedback = "请先登录你的账号。";
      saveSessionId("");
      renderControls();
      window.location.href = "./login.html";
      return null;
    }
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

  async function clearAccountData() {
    if (!state.auth.user || state.clearAccountDataSubmitting) {
      return;
    }
    state.clearAccountDataSubmitting = true;
    renderClearAccountDataModal();
    try {
      await fetchApiJson("/api/account/clear-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      resetCurrentAccountLocalState(state.auth.user.id);
      closeClearAccountDataModal();
      render();
      setSaveStatus("当前账号数据已清空", "success");
    } catch (error) {
      console.warn("Failed to clear account data.", error);
      state.clearAccountDataSubmitting = false;
      setSaveStatus(error?.message || "清空账号数据失败");
      renderClearAccountDataModal();
    }
  }

  async function handleDeleteAccountSubmit(event) {
    if (event.target !== elements.deleteAccountForm) {
      return;
    }
    event.preventDefault();
    if (!state.auth.user || state.deleteAccountSubmitting) {
      return;
    }
    const formData = new FormData(elements.deleteAccountForm);
    const password = String(formData.get("password") || "");
    if (!password) {
      state.auth.feedback = "请输入当前密码。";
      renderDeleteAccountModal();
      return;
    }
    state.deleteAccountSubmitting = true;
    state.auth.feedback = "正在删除账号...";
    renderDeleteAccountModal();
    try {
      await fetchApiJson("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const scopeKey = state.auth.user.id;
      resetCurrentAccountLocalState(scopeKey);
      saveSessionId("");
      saveAuthConfig({ username: "" });
      window.location.href = "./login.html";
    } catch (error) {
      console.warn("Failed to delete account.", error);
      state.auth.feedback = error?.message || "删除账号失败";
      state.deleteAccountSubmitting = false;
      renderDeleteAccountModal();
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
    renderClearAccountDataModal,
    renderDeleteAccountModal,
    loadAccountProfile,
    openAccountMenu,
    closeAccountMenu,
    toggleAccountMenu,
    openAccountProfileModal,
    closeAccountProfileModal,
    handleAccountProfilePreferencesSubmit,
    openChangePasswordModal,
    closeChangePasswordModal,
    openClearAccountDataModal,
    closeClearAccountDataModal,
    openDeleteAccountModal,
    closeDeleteAccountModal,
    initAuthClient,
    handleChangePasswordSubmit,
    clearAccountData,
    handleDeleteAccountSubmit,
    handleAuthAction,
  };
}
