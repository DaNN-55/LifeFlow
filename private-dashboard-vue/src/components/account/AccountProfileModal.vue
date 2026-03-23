<script setup>
import SettingsModal from "./SettingsModal.vue";

defineProps({
  open: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  profileData: { type: Object, default: null },
  profileFeedback: { type: String, default: "" },
  securityFeedback: { type: String, default: "" },
  dangerFeedback: { type: String, default: "" },
  recoveryCode: { type: String, default: "" },
  recoveryBusy: { type: Boolean, default: false },
  usernameBusy: { type: Boolean, default: false },
  signOutAllBusy: { type: Boolean, default: false },
  clearDataBusy: { type: Boolean, default: false },
  deleteAccountBusy: { type: Boolean, default: false },
  profileForm: { type: Object, required: true },
  accountForm: { type: Object, required: true },
  formatDateTime: { type: Function, required: true },
});

const emit = defineEmits([
  "close",
  "update:profile-form",
  "update:account-form",
  "save",
  "regenerate-recovery",
  "change-username",
  "signout-all",
  "clear-data",
  "delete-account",
]);
</script>

<template>
  <SettingsModal :open="open" title="当前账号资料" @close="emit('close')">
    <div class="account-profile-body">
      <p v-if="loading" class="settings-copy">正在同步最新账号资料...</p>
      <div class="account-profile-grid">
        <div class="account-profile-item">
          <span class="account-profile-label">用户名</span>
          <strong>{{ profileData?.user?.username || "--" }}</strong>
        </div>
        <div class="account-profile-item">
          <span class="account-profile-label">创建时间</span>
          <strong>{{ profileData?.user?.createdAt ? formatDateTime(profileData.user.createdAt) : "--" }}</strong>
        </div>
      </div>

      <div class="account-profile-stats">
        <div class="account-profile-stat">
          <span>任务数</span>
          <strong>{{ Number(profileData?.counts?.tasks || 0) }}</strong>
        </div>
        <div class="account-profile-stat">
          <span>每日记录</span>
          <strong>{{ Number(profileData?.counts?.dailyRecords || 0) }}</strong>
        </div>
        <div class="account-profile-stat">
          <span>周总结</span>
          <strong>{{ Number(profileData?.counts?.weeklySummaries || 0) }}</strong>
        </div>
      </div>

      <form class="account-form account-preferences-form" @submit.prevent="emit('save')">
          <div class="account-profile-item">
            <span class="account-profile-label">面板开关</span>
            <div class="account-card-toggle-list">
              <div class="account-card-toggle-column">
                <label class="account-card-toggle">
                  <span>日历</span>
                  <span class="account-toggle-switch">
                    <input
                      type="checkbox"
                      :checked="profileForm.sidebar.calendar"
                      @change="
                        emit('update:profile-form', {
                          ...profileForm,
                          sidebar: { ...profileForm.sidebar, calendar: $event.target.checked },
                        })
                      "
                    />
                    <span class="account-toggle-track"></span>
                  </span>
                </label>
                <label class="account-card-toggle">
                  <span>GitHub</span>
                  <span class="account-toggle-switch">
                    <input
                      type="checkbox"
                      :checked="profileForm.sidebar.github"
                      @change="
                        emit('update:profile-form', {
                          ...profileForm,
                          sidebar: { ...profileForm.sidebar, github: $event.target.checked },
                        })
                      "
                    />
                    <span class="account-toggle-track"></span>
                  </span>
                </label>
                <label class="account-card-toggle">
                  <span>Finance</span>
                  <span class="account-toggle-switch">
                    <input
                      type="checkbox"
                      :checked="profileForm.sidebar.financeFeed"
                      @change="
                        emit('update:profile-form', {
                          ...profileForm,
                          sidebar: { ...profileForm.sidebar, financeFeed: $event.target.checked },
                        })
                      "
                    />
                    <span class="account-toggle-track"></span>
                  </span>
                </label>
                <label class="account-card-toggle">
                  <span>Science</span>
                  <span class="account-toggle-switch">
                    <input
                      type="checkbox"
                      :checked="profileForm.sidebar.scienceFeed"
                      @change="
                        emit('update:profile-form', {
                          ...profileForm,
                          sidebar: { ...profileForm.sidebar, scienceFeed: $event.target.checked },
                        })
                      "
                    />
                    <span class="account-toggle-track"></span>
                  </span>
                </label>
              </div>
              <div class="account-card-toggle-column">
                <label class="account-card-toggle">
                  <span>天气</span>
                  <span class="account-toggle-switch">
                    <input
                      type="checkbox"
                      :checked="profileForm.sidebar.weather"
                      @change="
                        emit('update:profile-form', {
                          ...profileForm,
                          sidebar: { ...profileForm.sidebar, weather: $event.target.checked },
                        })
                      "
                    />
                    <span class="account-toggle-track"></span>
                  </span>
                </label>
                <label class="account-card-toggle">
                  <span>股票</span>
                  <span class="account-toggle-switch">
                    <input
                      type="checkbox"
                      :checked="profileForm.sidebar.stock"
                      @change="
                        emit('update:profile-form', {
                          ...profileForm,
                          sidebar: { ...profileForm.sidebar, stock: $event.target.checked },
                        })
                      "
                    />
                    <span class="account-toggle-track"></span>
                  </span>
                </label>
                <label class="account-card-toggle">
                  <span>Favorites</span>
                  <span class="account-toggle-switch">
                    <input
                      type="checkbox"
                      :checked="profileForm.sidebar.favorites"
                      @change="
                        emit('update:profile-form', {
                          ...profileForm,
                          sidebar: { ...profileForm.sidebar, favorites: $event.target.checked },
                        })
                      "
                    />
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
                <input
                  :value="profileForm.profile.birthDate"
                  type="date"
                  @input="
                    emit('update:profile-form', {
                      ...profileForm,
                      profile: { ...profileForm.profile, birthDate: $event.target.value },
                    })
                  "
                />
              </label>
              <label>
                <span class="settings-copy">默认寿命</span>
                <input
                  :value="profileForm.profile.lifeExpectancyYears"
                  type="number"
                  min="1"
                  max="150"
                  @input="
                    emit('update:profile-form', {
                      ...profileForm,
                      profile: { ...profileForm.profile, lifeExpectancyYears: Number($event.target.value || 80) },
                    })
                  "
                />
              </label>
            </div>
          </div>

          <div class="account-profile-item">
            <span class="account-profile-label">组件设置</span>
            <div class="settings-grid-two">
              <label>
                <span class="settings-copy">GitHub 主页</span>
                <input
                  :value="profileForm.widgets.github.profileUrl"
                  type="url"
                  placeholder="https://github.com/your-name"
                  @input="
                    emit('update:profile-form', {
                      ...profileForm,
                      widgets: {
                        ...profileForm.widgets,
                        github: { ...profileForm.widgets.github, profileUrl: $event.target.value },
                      },
                    })
                  "
                />
              </label>
              <label>
                <span class="settings-copy">Favorites 频道</span>
                <select
                  :value="profileForm.widgets.favorites.channel"
                  @change="
                    emit('update:profile-form', {
                      ...profileForm,
                      widgets: {
                        ...profileForm.widgets,
                        favorites: { ...profileForm.widgets.favorites, channel: $event.target.value },
                      },
                    })
                  "
                >
                  <option value="all">全部频道</option>
                  <option value="finance">Finance</option>
                  <option value="science">Science</option>
                  <option value="ai">AI</option>
                </select>
              </label>
              <label>
                <span class="settings-copy">天气位置</span>
                <input
                  :value="profileForm.widgets.weather.locationQuery"
                  type="text"
                  placeholder="例如：杭州"
                  @input="
                    emit('update:profile-form', {
                      ...profileForm,
                      widgets: {
                        ...profileForm.widgets,
                        weather: { ...profileForm.widgets.weather, locationQuery: $event.target.value },
                      },
                    })
                  "
                />
              </label>
              <label>
                <span class="settings-copy">股票代码</span>
                <input
                  :value="profileForm.widgets.stock.symbols"
                  type="text"
                  placeholder="贵州茅台,宁德时代,000001"
                  @input="
                    emit('update:profile-form', {
                      ...profileForm,
                      widgets: {
                        ...profileForm.widgets,
                        stock: { ...profileForm.widgets.stock, symbols: $event.target.value },
                      },
                    })
                  "
                />
              </label>
            </div>
          </div>

          <div class="delete-task-dialog-actions">
            <button type="submit" class="settings-save">保存面板设置</button>
          </div>
        </form>

        <form class="account-form" @submit.prevent="emit('change-username')">
          <div class="account-profile-item">
            <span class="account-profile-label">账号设置</span>
            <div class="settings-grid-two">
              <label>
                <span class="settings-copy">用户名</span>
                <input
                  :value="accountForm.username"
                  type="text"
                  maxlength="64"
                  @input="
                    emit('update:account-form', { ...accountForm, username: $event.target.value })
                  "
                />
              </label>
              <label>
                <span class="settings-copy">当前密码</span>
                <input
                  :value="accountForm.currentPassword"
                  type="password"
                  autocomplete="current-password"
                  @input="
                    emit('update:account-form', { ...accountForm, currentPassword: $event.target.value })
                  "
                />
              </label>
            </div>
            <p v-if="securityFeedback" class="settings-copy">{{ securityFeedback }}</p>
          </div>
          <div class="delete-task-dialog-actions">
            <button type="submit" class="task-cancel-action" :disabled="usernameBusy">
              {{ usernameBusy ? "保存中..." : "更新用户名" }}
            </button>
            <button type="button" class="task-cancel-action" :disabled="signOutAllBusy" @click="emit('signout-all')">
              {{ signOutAllBusy ? "退出中..." : "退出全部登录" }}
            </button>
          </div>
      </form>

      <form class="account-form" @submit.prevent="emit('regenerate-recovery')">
          <div class="account-profile-item">
            <span class="account-profile-label">密码找回</span>
            <p class="settings-copy">恢复码仅展示一次。请保存在安全位置，忘记密码时可在登录页配合验证码重置。</p>
            <p v-if="profileFeedback" class="settings-copy">{{ profileFeedback }}</p>
            <pre v-if="recoveryCode" class="delete-task-dialog-copy mono">{{ recoveryCode }}</pre>
          </div>
          <div class="delete-task-dialog-actions">
            <button type="submit" class="task-cancel-action" :disabled="recoveryBusy">
              {{ recoveryBusy ? "生成中..." : "生成新的恢复码" }}
            </button>
          </div>
      </form>

      <form class="account-form" @submit.prevent="emit('delete-account')">
          <div class="account-profile-item is-danger-zone">
            <span class="account-profile-label">危险操作</span>
            <p class="settings-copy">清空会删除当前账号下的任务、每日记录和周总结；删除账号会彻底移除账号与云端数据。</p>
            <label class="settings-field">
              <span class="settings-copy">删除账号前请输入当前密码</span>
              <input
                :value="accountForm.deletePassword"
                type="password"
                autocomplete="current-password"
                @input="emit('update:account-form', { ...accountForm, deletePassword: $event.target.value })"
              />
            </label>
            <p v-if="dangerFeedback" class="settings-copy">{{ dangerFeedback }}</p>
          </div>
          <div class="delete-task-dialog-actions">
            <button type="button" class="task-cancel-action" :disabled="clearDataBusy" @click="emit('clear-data')">
              {{ clearDataBusy ? "清空中..." : "清空当前账号数据" }}
            </button>
            <button type="submit" class="settings-save is-danger" :disabled="deleteAccountBusy">
              {{ deleteAccountBusy ? "删除中..." : "删除账号" }}
            </button>
          </div>
      </form>
    </div>
  </SettingsModal>
</template>
