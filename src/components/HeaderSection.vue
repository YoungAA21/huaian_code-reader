<template>
  <div class="header-section">
    <div class="title-bar">
      <div class="logo-area">
        <div class="logo-mark"></div>
        <h1>卷包车间检测监控中心</h1>
      </div>
      <div class="right-area">
        <ThemeToggle />
        <div class="datetime-area">
          <div class="time">{{ currentTime }}</div>
          <div class="date">{{ currentDate }}</div>
        </div>
      </div>
    </div>

    <div class="kpi-row">
      <div class="kpi-item" v-for="kpi in kpiList" :key="kpi.key">
        <div class="kpi-info">
          <span class="kpi-label">{{ kpi.label }}</span>
          <span class="kpi-number">{{ kpi.value }}</span>
        </div>
        <div class="kpi-unit">{{ kpi.unit }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ThemeToggle from './ThemeToggle.vue'

const props = defineProps<{
  currentTime: string
  currentDate: string
  detectors: any[]
  threshold: { warning: number; danger: number }
}>()

const kpiList = computed(() => [
  { key: 'total', label: '检测器总数', value: props.detectors.length, unit: '台' },
  { key: 'online', label: '在线数量', value: props.detectors.filter(d => d.isConnected).length, unit: '台' },
  { key: 'warning', label: '警告', value: props.detectors.filter(d => d.displayValue >= props.threshold.warning && d.displayValue < props.threshold.danger).length, unit: '台' },
  { key: 'danger', label: '危险', value: props.detectors.filter(d => d.displayValue >= props.threshold.danger).length, unit: '台' },
])
</script>

<style scoped>
.header-section {
  margin-bottom: 32px;
}

.title-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 28px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-light);
}

.right-area {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-mark {
  width: 32px;
  height: 32px;
  background: var(--success);
  border-radius: 8px;
  position: relative;
}

.logo-mark::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 12px;
  height: 12px;
  background: var(--success-light);
  border-radius: 50%;
}

.logo-area h1 {
  font-size: 32px;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
  letter-spacing: -0.3px;
}

.datetime-area {
  text-align: right;
}

.time {
  font-size: 30px;
  font-weight: 600;
  font-family: 'SF Mono', 'JetBrains Mono', monospace;
  color: var(--text-primary);
  line-height: 1.2;
}

.date {
  font-size: 17px;
  color: var(--text-muted);
  margin-top: 2px;
}

/* KPI 行 */
.kpi-row {
  display: flex;
  gap: 1px;
  background: var(--border-light);
  border-radius: 12px;
  overflow: hidden;
}

.kpi-item {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-card);
  padding: 20px 28px;
}

.kpi-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.kpi-label {
  font-size: 18px;
  color: var(--text-muted);
  font-weight: 500;
}

.kpi-number {
  font-size: 32px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
}

.kpi-unit {
  font-size: 17px;
  color: var(--text-muted);
}

@media (max-width: 768px) {
  .title-bar {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  .right-area {
    width: 100%;
    justify-content: space-between;
  }
  .logo-area h1 {
    font-size: 18px;
  }
  .time {
    font-size: 22px;
  }
  .kpi-row {
    flex-wrap: wrap;
  }
  .kpi-item {
    min-width: calc(50% - 0.5px);
  }
}
</style>