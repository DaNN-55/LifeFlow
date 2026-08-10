<script setup>
defineProps({
  weather: {
    type: Object,
    required: true,
  },
  buildPolyline: {
    type: Function,
    required: true,
  },
  buildAxis: {
    type: Function,
    required: true,
  },
  buildHotspots: {
    type: Function,
    required: true,
  },
  controlsEnabled: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits(["refresh", "configure"]);
</script>

<template>
  <section class="rail-card widget-card" aria-labelledby="weather-title">
    <div class="section-head">
      <h2 id="weather-title">Weather</h2>
      <button v-if="controlsEnabled" type="button" class="icon-button" aria-label="打开天气组件设置" @click="emit('configure')">
        <span class="material-symbols-outlined">settings</span>
      </button>
    </div>

    <div class="widget-display">
      <div class="widget-stat">
        <div>
          <h3 class="widget-title">{{ weather.location || "位置待获取" }}</h3>
          <p class="widget-location">近 7 日气温变化</p>
        </div>
        <button v-if="controlsEnabled" type="button" class="widget-refresh-button" title="刷新天气" aria-label="刷新天气" @click="emit('refresh')">
          <span class="material-symbols-outlined">refresh</span>
        </button>
      </div>

      <div v-if="weather.forecast?.length" class="weather-chart" aria-label="近7日气温变化">
        <svg viewBox="0 0 260 112" class="weather-chart-svg" preserveAspectRatio="none">
          <line x1="30" y1="12" x2="30" y2="88" class="weather-axis"></line>
          <line x1="30" y1="88" x2="250" y2="88" class="weather-axis"></line>
          <line x1="30" y1="20" x2="250" y2="20" class="weather-grid"></line>
          <line x1="30" y1="54" x2="250" y2="54" class="weather-grid"></line>
          <polyline :points="buildPolyline(weather.forecast)"></polyline>
          <text x="8" y="20" class="weather-axis-label">{{ buildAxis(weather.forecast).max }}</text>
          <text x="8" y="56" class="weather-axis-label">{{ buildAxis(weather.forecast).mid }}</text>
          <text x="8" y="90" class="weather-axis-label">{{ buildAxis(weather.forecast).min }}</text>
          <text
            v-for="(item, index) in weather.forecast"
            :key="`${item.date}-${index}`"
            :x="30 + (index * 220) / Math.max(weather.forecast.length - 1, 1)"
            y="106"
            class="weather-axis-label weather-axis-day"
          >
            {{ item.axisLabel || index + 1 }}
          </text>
        </svg>
        <div class="weather-hotspots">
          <div
            v-for="(item, index) in buildHotspots(weather.forecast)"
            :key="`${item.dateLabel}-${index}`"
            class="weather-hotspot"
            :style="{ left: `${item.left}%` }"
          >
            <div class="weather-tooltip">
              <strong>{{ item.dateLabel }}</strong>
              <span>{{ item.weekdayLabel }}</span>
              <span>{{ item.tempLabel }}</span>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="weather-chart weather-chart-empty">
        <div class="weather-chart-label">暂无趋势数据</div>
      </div>

      <div class="widget-reading-line">
        <div class="widget-reading">{{ weather.temperature || "--" }}</div>
        <p class="widget-body">{{ weather.detail || "正在尝试获取当地天气。" }}</p>
      </div>
    </div>
  </section>
</template>
