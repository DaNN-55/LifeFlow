export function createWidgetsModule(deps) {
  const {
    state,
    elements,
    defaultWidgets,
    escapeHtml,
    escapeAttribute,
    formatDateTime,
    parseIsoDate,
    fetchApiJson,
    fetchJson,
    saveData,
    saveAccountPreferencesRemote,
    setSaveStatus,
    createEmptyWeatherState,
    loadWeatherCache,
    saveWeatherCache,
    getSidebarPreferences,
  } = deps;

  function renderFavoritesWidget() {
    const favorites = state.widgetData.favorites;
    const config = state.data.preferences.widgets.favorites || defaultWidgets.favorites;
    const channelFilter = config.channel || "all";
    const items = Array.isArray(favorites.items) ? favorites.items : [];
    if (!state.auth.user) {
      return '<p class="widget-status">登录后可查看最近收藏的资讯。</p>';
    }
    const filteredItems = items
      .filter((item) => channelFilter === "all" || item.channel === channelFilter)
      .slice(0, 3);
    if (!filteredItems.length) {
      return `<p class="widget-status">${escapeHtml(favorites.message || "当前还没有收藏资讯。")}</p>`;
    }
    return `
      <div class="favorites-widget-list">
        ${filteredItems
          .map(
            (item) => `
              <article class="favorites-widget-item">
                <button
                  type="button"
                  class="favorites-widget-link"
                  data-favorites-jump="${escapeAttribute(item.channel)}"
                >
                  <strong>${escapeHtml(item.title)}</strong>
                  <span class="feed-meta">${escapeHtml(item.source_name || item.channel)} // ${escapeHtml(formatDateTime(item.published_at || item.favorited_at || item.created_at))}</span>
                </button>
              </article>
            `,
          )
          .join("")}
      </div>
    `;
  }

  function renderGitHubWidget() {
    const repo = state.widgetData.github;
    const profileUrl = String(state.data.preferences.widgets.github?.profileUrl || "").trim();
    if (elements.githubCardLink) {
      elements.githubCardLink.href = profileUrl || "#";
      elements.githubCardLink.setAttribute("aria-disabled", profileUrl ? "false" : "true");
      elements.githubCardLink.tabIndex = profileUrl ? 0 : -1;
    }
    const items = Array.isArray(repo.repos) ? repo.repos.slice(0, 3) : [];
    if (!profileUrl) {
      return `
        <form class="github-profile-form" id="github-profile-form">
          <label class="settings-field">
            <span class="widget-label">GitHub 主页网址</span>
            <input name="githubProfileUrl" type="url" placeholder="https://github.com/your-name" />
          </label>
          <p class="settings-copy">启用 GitHub 卡片后，填写主页网址才会同步最近活跃仓库。</p>
          <div class="settings-actions">
            <button type="submit" class="settings-save">保存网址</button>
          </div>
        </form>
      `;
    }
    const list = items.length
      ? items
          .map(
            (item) => `
              <article class="github-repo-item">
                <div class="github-repo-copy">
                  <h3>${escapeHtml(item.name)}</h3>
                  <p>${escapeHtml(item.description || "暂无仓库简介。")}</p>
                </div>
                <div class="github-repo-meta">
                  <span class="feed-meta">${escapeHtml(item.updatedAt ? `Updated ${formatDateTime(item.updatedAt)}` : "Recently active")}</span>
                  <a class="show-more github-inline-link" href="${escapeAttribute(item.url)}" target="_blank" rel="noreferrer">
                    <span>${escapeHtml(item.shortUrl || "Open Repo")}</span>
                    <span class="material-symbols-outlined">arrow_outward</span>
                  </a>
                </div>
              </article>
            `,
          )
          .join("")
      : `
        <article class="github-repo-item">
          <div class="github-repo-copy">
            <h3>DanN-55 / life-flow</h3>
            <p>Dashboard preview for personal execution, market notes and research reading.</p>
          </div>
          <div class="github-repo-meta">
            <span class="feed-meta">GitHub 预览暂时不可用</span>
            <a class="show-more github-inline-link" href="${escapeAttribute(repo.url)}" target="_blank" rel="noreferrer">
              <span>Open GitHub</span>
              <span class="material-symbols-outlined">arrow_outward</span>
            </a>
          </div>
        </article>
      `;
    return `<div class="github-stream">${list}</div>`;
  }

  function renderWeatherWidget() {
    const weather = state.widgetData.weather;
    const axis = buildWeatherAxis(weather.forecast);
    const hotspots = buildWeatherHotspots(weather.forecast);
    const chart = weather.forecast.length
      ? `
        <div class="weather-chart" aria-label="近7日气温变化">
          <svg viewBox="0 0 260 112" class="weather-chart-svg" preserveAspectRatio="none">
            <line x1="30" y1="12" x2="30" y2="88" class="weather-axis"></line>
            <line x1="30" y1="88" x2="250" y2="88" class="weather-axis"></line>
            <line x1="30" y1="20" x2="250" y2="20" class="weather-grid"></line>
            <line x1="30" y1="54" x2="250" y2="54" class="weather-grid"></line>
            <polyline points="${buildWeatherPolyline(weather.forecast)}" />
            <text x="8" y="20" class="weather-axis-label">${axis.max}</text>
            <text x="8" y="56" class="weather-axis-label">${axis.mid}</text>
            <text x="8" y="90" class="weather-axis-label">${axis.min}</text>
            ${weather.forecast
              .map(
                (item, index) => `
                  <text x="${30 + (index * 220) / Math.max(weather.forecast.length - 1, 1)}" y="106" class="weather-axis-label weather-axis-day">${item.axisLabel || index + 1}</text>
                `,
              )
              .join("")}
          </svg>
          <div class="weather-hotspots">
            ${hotspots
              .map(
                (item) => `
                  <div class="weather-hotspot" style="left:${item.left}%;">
                    <div class="weather-tooltip">
                      <strong>${escapeHtml(item.dateLabel)}</strong>
                      <span>${escapeHtml(item.weekdayLabel)}</span>
                      <span>${escapeHtml(item.tempLabel)}</span>
                    </div>
                  </div>
                `,
              )
              .join("")}
          </div>
        </div>
      `
      : `
        <div class="weather-chart weather-chart-empty">
          <div class="weather-chart-label">暂无趋势数据</div>
        </div>
      `;
    return `
      <div class="widget-stat">
        <div>
          <h3 class="widget-title">${escapeHtml(weather.location || "位置待获取")}</h3>
          <p class="widget-location">近 7 日气温变化</p>
        </div>
        <button
          type="button"
          class="widget-refresh-button"
          data-weather-refresh
          title="刷新天气"
          aria-label="刷新天气"
        >
          <span class="material-symbols-outlined">refresh</span>
        </button>
      </div>
      ${chart}
      <div class="widget-reading-line">
        <div class="widget-reading">${escapeHtml(weather.temperature || "--")}</div>
        <p class="widget-body">${escapeHtml(weather.detail || "正在尝试获取当地天气。")}</p>
      </div>
    `;
  }

  function renderStockWidget() {
    const widget = state.data.preferences.widgets.stock;
    const stock = state.widgetData.stock;
    const list = stock.symbols.length
      ? stock.symbols
          .map(
            (item) => `
              <div class="widget-symbol market-row">
                <div class="market-meta">
                  <strong>${escapeHtml(item.name || item.symbol)}</strong>
                  <span>${escapeHtml(item.symbol)} ${escapeHtml(item.price)}</span>
                </div>
                <div class="market-trend market-trend-${escapeHtml(item.trend)}">
                  <svg viewBox="0 0 80 18" class="market-sparkline" preserveAspectRatio="none">
                    <polyline points="${sparklinePoints(item.trend)}"></polyline>
                  </svg>
                  <span>${escapeHtml(item.change)}</span>
                </div>
              </div>
            `,
          )
          .join("")
      : `
        <div class="widget-symbol">
          <strong>${escapeHtml(widget.symbols)}</strong>
          <span>--</span>
        </div>
      `;

    return `
      <div class="widget-stat">
        <div>
          <h3 class="widget-title">${escapeHtml(widget.title)}</h3>
        </div>
        <span class="material-symbols-outlined">finance_mode</span>
      </div>
      <div class="widget-symbol-list market-list">${list}</div>
      <p class="widget-status">${escapeHtml(stock.message || "尝试获取实时行情，失败时显示占位信息。")}</p>
    `;
  }

  function renderWidgets() {
    if (elements.favoritesWidgetDisplay) {
      elements.favoritesWidgetDisplay.innerHTML = renderFavoritesWidget();
    }
    if (elements.githubWidgetDisplay) {
      elements.githubWidgetDisplay.innerHTML = renderGitHubWidget();
    }
    elements.weatherWidgetDisplay.innerHTML = renderWeatherWidget();
    elements.stockWidgetDisplay.innerHTML = renderStockWidget();
  }

  function openWidgetSettings(widget) {
    state.modal.widget = widget;
    renderModal();
  }

  function closeModal() {
    state.modal.widget = null;
    renderModal();
  }

  function renderModal() {
    const widget = state.modal.widget;
    if (!widget) {
      elements.settingsModal.hidden = true;
      elements.settingsForm.innerHTML = "";
      return;
    }

    elements.settingsModal.hidden = false;
    elements.settingsTitle.textContent =
      widget === "weather" ? "Weather 设置" : widget === "stock" ? "Stock 设置" : "Favorites 设置";
    elements.settingsForm.innerHTML = renderSettingsForm(widget);
  }

  function renderSettingsForm(widget) {
    if (widget === "favorites") {
      const config = state.data.preferences.widgets.favorites;
      return `
        <label class="settings-field">
          <span class="widget-label">显示范围</span>
          <select name="favoritesChannel">
            <option value="all" ${config.channel === "all" ? "selected" : ""}>Finance + Science</option>
            <option value="finance" ${config.channel === "finance" ? "selected" : ""}>仅 Finance</option>
            <option value="science" ${config.channel === "science" ? "selected" : ""}>仅 Science</option>
          </select>
        </label>
        <div class="settings-actions">
          <button type="submit" class="settings-save">保存设置</button>
        </div>
      `;
    }
    if (widget === "weather") {
      const config = state.data.preferences.widgets.weather;
      return `
        <p class="settings-copy">可填写城市/地区名称来固定天气位置；留空时继续使用自动定位。</p>
        <label class="settings-field">
          <span class="widget-label">位置</span>
          <input name="locationQuery" type="text" placeholder="例如：上海、杭州西湖、Shenzhen" value="${escapeAttribute(config.locationQuery || "")}" />
        </label>
        <div class="settings-actions">
          <button type="submit" class="settings-save">保存设置</button>
        </div>
      `;
    }

    const config = state.data.preferences.widgets.stock;
    return `
      <p class="settings-copy">输入 A 股股票代码或股票名称，支持逗号或换行分隔，例如：贵州茅台、000001。</p>
      <label class="settings-field">
        <span class="widget-label">代码列表</span>
        <textarea name="symbols" placeholder="贵州茅台, 宁德时代, 000001">${escapeHtml(config.symbols)}</textarea>
      </label>
      <div class="settings-actions">
        <button type="submit" class="settings-save">保存设置</button>
      </div>
    `;
  }

  function saveWidgetSettings(formData) {
    if (state.modal.widget === "favorites") {
      state.data.preferences.widgets.favorites = {
        title: "Favorites",
        channel: String(formData.get("favoritesChannel") || defaultWidgets.favorites.channel),
      };
      saveData("已保存 Favorites 设置");
      closeModal();
      if (state.auth.user) {
        void saveAccountPreferencesRemote().catch((error) => {
          console.warn("Failed to save favorites preferences remotely.", error);
          setSaveStatus("Favorites 设置已保存在本地，云端同步稍后重试");
        });
      }
      renderWidgets();
      return;
    }

    if (state.modal.widget === "weather") {
      state.data.preferences.widgets.weather = {
        title: "Weather",
        locationQuery: String(formData.get("locationQuery") || "").trim(),
      };
      saveData("已保存 Weather 设置");
      closeModal();
      if (state.auth.user) {
        void saveAccountPreferencesRemote().catch((error) => {
          console.warn("Failed to save weather preferences remotely.", error);
          setSaveStatus("Weather 设置已保存在本地，云端同步稍后重试");
        });
      }
      void refreshWeather().finally(() => {
        renderWidgets();
      });
      return;
    }

    if (state.modal.widget === "stock") {
      state.data.preferences.widgets.stock = {
        title: "A股概览",
        symbols: normalizeSymbols(
          String(formData.get("symbols") || defaultWidgets.stock.symbols),
        ),
      };
      saveData("已保存 Stock 设置");
      closeModal();
      if (state.auth.user) {
        void saveAccountPreferencesRemote().catch((error) => {
          console.warn("Failed to save stock preferences remotely.", error);
          setSaveStatus("Stock 设置已保存在本地，云端同步稍后重试");
        });
      }
      void refreshStocks();
      renderWidgets();
    }
  }

  async function handleGitHubProfileSubmit(event) {
    const form = event.target.closest("#github-profile-form");
    if (!form) {
      return;
    }
    event.preventDefault();
    const profileUrl = String(new FormData(form).get("githubProfileUrl") || "").trim();
    state.data.preferences.widgets.github.profileUrl = profileUrl;
    if (state.auth.user) {
      try {
        await saveAccountPreferencesRemote();
      } catch (error) {
        console.warn("Failed to save GitHub profile URL remotely.", error);
        setSaveStatus("GitHub 主页网址已保存在本地，云端同步稍后重试");
      }
    }
    renderWidgets();
    await refreshGitHubRepo();
    renderWidgets();
    setSaveStatus(profileUrl ? "已保存 GitHub 主页网址" : "已清空 GitHub 主页网址", "success");
  }

  async function refreshExternalData() {
    const jobs = [];
    if (getSidebarPreferences().github) {
      jobs.push(refreshGitHubRepo());
    }
    if (getSidebarPreferences().weather) {
      jobs.push(refreshWeather());
    }
    if (getSidebarPreferences().stock) {
      jobs.push(refreshStocks());
    }
    await Promise.allSettled(jobs);
    renderWidgets();
  }

  function parseGitHubOwnerFromUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) {
      return "";
    }
    try {
      const parsed = new URL(raw);
      if (!/github\.com$/i.test(parsed.hostname)) {
        return "";
      }
      const [owner] = parsed.pathname.split("/").filter(Boolean);
      return owner || "";
    } catch (error) {
      return "";
    }
  }

  async function refreshGitHubRepo() {
    const profileUrl = String(state.data.preferences.widgets.github?.profileUrl || "").trim();
    const owner = parseGitHubOwnerFromUrl(profileUrl);
    const fallback = {
      status: "fallback",
      repos: [
        {
          name: "DanN-55 / life-flow",
          description: "Dashboard preview for personal execution, market notes and research reading.",
          updatedAt: "",
          url: "https://github.com/DanN-55/life-flow",
          shortUrl: "life-flow",
        },
      ],
      url: profileUrl,
      message: "最近活跃仓库",
    };
    if (!owner || !profileUrl) {
      state.widgetData.github = {
        status: "idle",
        repos: [],
        url: profileUrl,
        message: "等待配置 GitHub 主页",
      };
      return;
    }
    state.widgetData.github = {
      ...state.widgetData.github,
      status: "loading",
      url: profileUrl,
      message: "正在同步仓库列表",
    };
    renderWidgets();

    try {
      const payload = await fetchJson(
        `https://api.github.com/users/${owner}/repos?sort=pushed&per_page=6`,
        {
          credentials: "omit",
          timeoutMs: 6000,
          headers: {
            Accept: "application/vnd.github+json",
          },
        },
      );
      const repos = Array.isArray(payload)
        ? payload
            .filter((repo) => !repo.fork)
            .sort((left, right) => {
              const leftTime = new Date(left.pushed_at || left.updated_at || 0).getTime();
              const rightTime = new Date(right.pushed_at || right.updated_at || 0).getTime();
              return rightTime - leftTime;
            })
            .slice(0, 3)
            .map((repo) => ({
              name: repo.full_name || repo.name || "Repository",
              description: repo.description || "暂无仓库简介。",
              updatedAt: repo.pushed_at || repo.updated_at || "",
              url: repo.html_url || profileUrl,
              shortUrl: repo.name || "Open Repo",
            }))
        : [];
      state.widgetData.github = {
        status: "ready",
        repos: repos.length ? repos : fallback.repos,
        url: profileUrl,
        message: "最近活跃仓库",
      };
    } catch (error) {
      state.widgetData.github = {
        ...fallback,
        status: "error",
        url: profileUrl,
        message: "GitHub 预览暂时不可用",
      };
    }
  }

  async function refreshWeather() {
    const cachedWeather = loadWeatherCache();
    state.widgetData.weather = {
      ...cachedWeather,
      status: "loading",
      location: cachedWeather.location || "定位中...",
      temperature: cachedWeather.temperature || "--",
      detail: cachedWeather.forecast.length ? "正在刷新天气信息" : "正在获取天气信息",
      message: cachedWeather.forecast.length
        ? "当前展示最近一次成功结果"
        : "",
    };
    renderWidgets();

    try {
      const manualLocation = String(
        state.data.preferences.widgets.weather?.locationQuery || "",
      ).trim();
      const browserLocation = manualLocation ? null : await getAutoLocation().catch(() => null);
      const query = manualLocation
        ? `?query=${encodeURIComponent(manualLocation)}`
        : browserLocation
          ? `?latitude=${encodeURIComponent(browserLocation.latitude)}&longitude=${encodeURIComponent(browserLocation.longitude)}`
          : "";
      const payload = await fetchApiJson(`/api/widgets/weather${query}`, {
        requireAuth: false,
      });
      const forecast = Array.isArray(payload?.weather?.forecast)
        ? payload.weather.forecast.map((item) => ({
            max: item.max,
            min: item.min,
            date: item.date,
            dayLabel: formatWeekday(item.date),
            axisLabel: formatWeekdayShortEn(item.date),
            dateLabel: formatMonthDayLabel(item.date),
          }))
        : [];

      state.widgetData.weather = {
        ...createEmptyWeatherState(),
        ...payload.weather,
        status: "ready",
        forecast,
      };
      saveWeatherCache(state.widgetData.weather);
    } catch (error) {
      if (cachedWeather.forecast.length) {
        state.widgetData.weather = {
          ...cachedWeather,
          status: "stale",
          detail: cachedWeather.detail || "已展示最近一次天气结果",
          message: "定位暂时不可用，当前展示最近一次成功结果",
        };
        return;
      }
      state.widgetData.weather = {
        ...createEmptyWeatherState(),
        status: "error",
        location: "位置不可用",
        temperature: "--",
        detail: "未能获取天气数据",
        message: "定位与天气接口均失败，请点击刷新重试",
      };
    }
  }

  async function refreshStocks() {
    const queries = normalizeSymbols(state.data.preferences.widgets.stock.symbols)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 4);

    state.widgetData.stock = {
      status: "loading",
      symbols: [],
      message: "正在获取行情",
    };
    renderWidgets();

    try {
      const resolved = await resolveAStockQueries(queries);
      if (!resolved.length) {
        throw new Error("No stock resolved");
      }
      const quotes = await fetchSinaQuotes(resolved.map((item) => item.symbol));

      state.widgetData.stock = {
        status: "ready",
        symbols: resolved.map((item) => {
          const quote = quotes.find((entry) => entry.symbol === item.symbol);
          if (!quote) {
            return {
              symbol: item.symbol,
              name: item.name,
              price: "--",
              change: "--",
              trend: "flat",
            };
          }
          return {
            symbol: item.symbol.toUpperCase(),
            name: quote.name || item.name,
            price: quote.price,
            change: quote.change,
            trend: quote.trend,
          };
        }),
        message: "A 股实时行情",
      };
    } catch (error) {
      state.widgetData.stock = {
        status: "error",
        symbols: queries.map((symbol) => ({
          symbol,
          name: symbol,
          price: "--",
          change: "--",
          trend: "flat",
        })),
        message: "A 股行情获取失败，请检查代码或名称",
      };
    }
  }

  function getAutoLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation unavailable"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        reject,
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 },
      );
    });
  }

  function normalizeSymbols(value) {
    return value
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .join(",");
  }

  async function resolveAStockQueries(queries) {
    const results = [];
    for (const query of queries) {
      const resolved = isAStockCode(query)
        ? normalizeAStockCode(query)
        : await resolveStockByName(query);
      if (resolved) {
        results.push(resolved);
      }
    }
    return dedupeStocks(results);
  }

  function isAStockCode(query) {
    return /^(sh|sz)?\d{6}$/i.test(query);
  }

  function normalizeAStockCode(query) {
    const normalized = query.toLowerCase();
    if (/^(sh|sz)\d{6}$/.test(normalized)) {
      return { symbol: normalized, name: normalized.toUpperCase() };
    }
    const code = normalized.replace(/\D/g, "");
    const prefix = /^(5|6|9)/.test(code) ? "sh" : "sz";
    return { symbol: `${prefix}${code}`, name: code };
  }

  async function resolveStockByName(query) {
    const callbackName = `stock_suggest_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const raw = await loadScriptVariable(
      `https://suggest3.sinajs.cn/suggest/type=11,12,13,14,15&key=${encodeURIComponent(query)}&name=${callbackName}`,
      callbackName,
    );

    if (!raw) {
      return null;
    }

    const firstEntry = String(raw)
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)[0];

    if (!firstEntry) {
      return null;
    }

    const tokens = firstEntry
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const symbol = tokens.find((item) => /^(sh|sz)\d{6}$/i.test(item));
    const name = tokens.find((item) => /[\u4e00-\u9fa5]/.test(item)) || query;

    return symbol ? { symbol: symbol.toLowerCase(), name } : null;
  }

  function dedupeStocks(stocks) {
    const seen = new Set();
    return stocks.filter((item) => {
      if (seen.has(item.symbol)) {
        return false;
      }
      seen.add(item.symbol);
      return true;
    });
  }

  async function fetchSinaQuotes(symbols) {
    if (!symbols.length) {
      return [];
    }

    await loadRemoteScript(`https://hq.sinajs.cn/list=${symbols.join(",")}`);
    return symbols
      .map((symbol) => {
        const raw = window[`hq_str_${symbol}`];
        if (!raw) {
          return null;
        }
        const parts = String(raw).split(",");
        const name = parts[0] || symbol.toUpperCase();
        const prevClose = Number(parts[2]) || 0;
        const price = Number(parts[3]) || 0;
        const changeValue = prevClose
          ? ((price - prevClose) / prevClose) * 100
          : 0;
        return {
          symbol,
          name,
          price: price ? price.toFixed(2) : "--",
          change: `${changeValue >= 0 ? "+" : ""}${changeValue.toFixed(2)}%`,
          trend: changeValue > 0 ? "up" : changeValue < 0 ? "down" : "flat",
        };
      })
      .filter(Boolean);
  }

  function loadRemoteScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => {
        script.remove();
        resolve();
      };
      script.onerror = () => {
        script.remove();
        reject(new Error(`Failed to load script: ${src}`));
      };
      document.head.appendChild(script);
    });
  }

  async function loadScriptVariable(src, variableName) {
    await loadRemoteScript(src);
    const value = window[variableName];
    try {
      delete window[variableName];
    } catch (error) {
      window[variableName] = undefined;
    }
    return value;
  }

  function buildWeatherPolyline(forecast) {
    const values = forecast
      .flatMap((item) => [item.max, item.min])
      .filter((value) => Number.isFinite(value));
    if (!values.length) {
      return "30,86 250,86";
    }
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const range = maxValue - minValue || 1;
    return forecast
      .map((item, index) => {
        const x = 30 + (index * 220) / Math.max(forecast.length - 1, 1);
        const avg = (item.max + item.min) / 2;
        const y = 84 - ((avg - minValue) / range) * 60;
        return `${x},${y}`;
      })
      .join(" ");
  }

  function buildWeatherAxis(forecast) {
    const values = forecast
      .flatMap((item) => [item.max, item.min])
      .filter((value) => Number.isFinite(value));
    if (!values.length) {
      return { max: "--", mid: "--", min: "--" };
    }
    const max = Math.round(Math.max(...values));
    const min = Math.round(Math.min(...values));
    const mid = Math.round((max + min) / 2);
    return { max: `${max}°`, mid: `${mid}°`, min: `${min}°` };
  }

  function buildWeatherHotspots(forecast) {
    if (!forecast.length) {
      return [];
    }
    return forecast.map((item, index) => ({
      left: (index * 100) / Math.max(forecast.length - 1, 1),
      weekdayLabel: item.dayLabel || `${index + 1}`,
      dateLabel: item.dateLabel || "--/--",
      tempLabel: `${Math.round(item.min)}°C - ${Math.round(item.max)}°C`,
    }));
  }

  function formatWeekday(dateString) {
    const date = parseIsoDate(dateString);
    if (!date) {
      return "--";
    }
    return new Intl.DateTimeFormat("zh-CN", { weekday: "long" }).format(date);
  }

  function formatWeekdayShortEn(dateString) {
    const date = parseIsoDate(dateString);
    if (!date) {
      return "--";
    }
    return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date);
  }

  function formatMonthDayLabel(dateString) {
    const date = parseIsoDate(dateString);
    if (!date) {
      return "--/--";
    }
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }

  function sparklinePoints(trend) {
    if (trend === "up") {
      return "0,14 10,12 20,13 30,9 40,8 50,10 60,6 70,7 80,4";
    }
    if (trend === "down") {
      return "0,4 10,6 20,5 30,8 40,9 50,11 60,12 70,13 80,14";
    }
    return "0,9 80,9";
  }

  return {
    renderWidgets,
    renderFavoritesWidget,
    renderGitHubWidget,
    renderWeatherWidget,
    renderStockWidget,
    openWidgetSettings,
    closeModal,
    renderModal,
    saveWidgetSettings,
    handleGitHubProfileSubmit,
    refreshExternalData,
    refreshGitHubRepo,
    refreshWeather,
    refreshStocks,
    normalizeSymbols,
  };
}
