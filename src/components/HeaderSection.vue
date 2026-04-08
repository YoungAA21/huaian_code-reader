<template>
  <div class="header-section">
    <!-- 标题栏 -->
    <div class="title-bar">
      <div class="logo">
        <svg width="44" height="44" viewBox="0 0 40 40">
          <rect x="10" y="10" width="20" height="20" rx="4" fill="#00ff88" fill-opacity="0.3" stroke="#00ff88" stroke-width="1.5"/>
          <circle cx="20" cy="20" r="6" fill="#00ff88">
            <animate attributeName="r" values="6;8;6" dur="2s" repeatCount="indefinite"/>
          </circle>
        </svg>
        <h1>卷包车间检测监控中心</h1>
      </div>
      <div class="datetime">
        <div class="time">{{ currentTime }}</div>
        <div class="date">{{ currentDate }}</div>
      </div>
    </div>

    <!-- KPI 卡片 -->
    <div class="kpi-grid">
      <div class="kpi-card" v-for="kpi in kpiList" :key="kpi.key">
        <div class="kpi-icon">{{ kpi.icon }}</div>
        <div class="kpi-label">{{ kpi.label }}</div>
        <div class="kpi-value">{{ kpi.value }}<span class="unit">{{ kpi.unit }}</span></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  currentTime: string
  currentDate: string
  detectors: any[]
  threshold: { warning: number; danger: number }
}>()

const kpiList = computed(() => [
  { key: 'total', label: '检测器总数', value: props.detectors.length, unit: '台', icon: '📊' },
  { key: 'online', label: '在线数量', value: props.detectors.filter(d => d.isConnected).length, unit: '台', icon: '🟢' },
  { key: 'warning', label: '警告', value: props.detectors.filter(d => d.displayValue >= props.threshold.warning && d.displayValue < props.threshold.danger).length, unit: '台', icon: '⚠️' },
  { key: 'danger', label: '危险', value: props.detectors.filter(d => d.displayValue >= props.threshold.danger).length, unit: '台', icon: '🔴' },
])
</script>

<style scoped>
.header-section { position: relative; z-index: 10; margin-bottom: 40px; }

.title-bar {
  display: flex; justify-content: space-between; align-items: flex-end;
  margin-bottom: 28px; padding-bottom: 20px; border-bottom: 1px solid rgba(0,255,136,0.3);
}
.logo { display: flex; align-items: center; gap: 16px; }
.logo h1 { font-size: 30px; font-weight: 600; background: linear-gradient(135deg, #fff, #00ff88); -webkit-background-clip: text; background-clip: text; color: transparent; margin: 0; }
.datetime { text-align: right; font-family: monospace; }
.time { font-size: 36px; font-weight: 700; color: #00ff88; text-shadow: 0 0 10px rgba(0,255,136,0.5); }
.date { font-size: 16px; color: #88aabb; }

.kpi-grid {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 20px;
}
.kpi-card {
  background: linear-gradient(135deg, rgba(10,20,30,0.8), rgba(5,10,15,0.9));
  backdrop-filter: blur(10px); border-radius: 20px; padding: 20px;
  border: 1px solid rgba(0,255,136,0.2); text-align: center;
  transition: all 0.3s;
}
.kpi-card:hover { transform: translateY(-2px); border-color: rgba(0,255,136,0.5); }
.kpi-icon { font-size: 36px; margin-bottom: 10px; }
.kpi-label { font-size: 16px; color: #88aabb; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; }
.kpi-value { font-size: 36px; font-weight: bold; color: #fff; }
.kpi-value .unit { font-size: 16px; color: #88aabb; margin-left: 6px; }

@media (max-width: 1200px) { .kpi-grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 768px) {
  .title-bar { flex-direction: column; align-items: flex-start; gap: 16px; }
  .time { font-size: 28px; }
  .logo h1 { font-size: 22px; }
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>