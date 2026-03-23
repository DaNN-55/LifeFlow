<script setup>
defineProps({
  stock: {
    type: Object,
    required: true,
  },
  title: {
    type: String,
    default: "A股概览",
  },
  formatCode: {
    type: Function,
    required: true,
  },
  sparklinePoints: {
    type: Function,
    required: true,
  },
  formatDateTime: {
    type: Function,
    required: true,
  },
});

const emit = defineEmits(["refresh", "configure"]);
</script>

<template>
  <section class="rail-card widget-card" aria-labelledby="stock-title">
    <div class="section-head">
      <h2 id="stock-title">Stock</h2>
      <button type="button" class="icon-button" aria-label="打开股票组件设置" @click="emit('configure')">
        <span class="material-symbols-outlined">settings</span>
      </button>
    </div>

    <div class="widget-display">
      <div class="widget-stat">
        <div>
          <h3 class="widget-title">{{ title }}</h3>
        </div>
        <button type="button" class="widget-refresh-button" title="刷新行情" aria-label="刷新行情" @click="emit('refresh')">
          <span class="material-symbols-outlined">refresh</span>
        </button>
      </div>

      <div class="widget-symbol-list market-list">
        <div v-for="item in stock.symbols" :key="item.symbol" class="widget-symbol market-row">
          <div class="market-meta">
            <strong>{{ item.name || item.symbol }}</strong>
            <span>{{ formatCode(item.symbol) }} {{ item.price }}</span>
          </div>
          <div class="market-trend" :class="`market-trend-${item.trend || 'flat'}`">
            <svg viewBox="0 0 80 18" class="market-sparkline" preserveAspectRatio="none">
              <polyline :points="sparklinePoints(item.trend || 'flat')"></polyline>
            </svg>
            <span>{{ item.change }}</span>
          </div>
        </div>
      </div>

      <p class="widget-status">
        {{ stock.updatedAt ? `${stock.message || 'A 股实时行情'} · ${formatDateTime(stock.updatedAt)}` : stock.message || '尝试获取实时行情，失败时显示占位信息。' }}
      </p>
    </div>
  </section>
</template>
