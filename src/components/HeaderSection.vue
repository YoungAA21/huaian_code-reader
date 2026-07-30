<template>
  <div class="header-section">
    <div class="title-bar">
      <div class="logo-area">
        <div class="logo-mark"></div>
        <h1>二维码健康监测</h1>
      </div>
      <div class="right-area">
        <!-- 产线下拉选择器 -->
        <div class="line-selector">
          <span class="selector-icon">🏭</span>
          <select v-model="selectedLine" class="line-select" @change="onLineChange">
            <option v-for="line in lines" :key="line.id" :value="line.id">
              {{ line.icon }} {{ line.name }}
            </option>
          </select>
        </div>
        <nav class="page-nav" aria-label="页面导航">
          <RouterLink class="trend-entry" to="/reader-trends">趋势对比</RouterLink>
          <RouterLink class="trend-entry secondary" to="/spare-parts">备件管理</RouterLink>
        </nav>
        <ThemeToggle />
        <div class="datetime-area">
          <div class="time">{{ currentTime }}</div>
          <div class="date">{{ currentDate }}</div>
        </div>
        <button class="fullscreen-toggle" @click="emit('toggleFullscreen')">
          {{ isFullscreen ? '退出全屏' : '全屏' }}
        </button>
      </div>
    </div>

    <!-- 产线状态信息行 -->
    <div class="line-status-row" v-if="productionStatus">
      <div class="status-badges">
        <span class="status-badge" :class="getRunStateClass()">
          {{ getRunStateIcon() }} {{ getRunStateText() }}
        </span>
        <span class="status-badge speed">
          ⚡ 车速: {{ productionStatus.speed }} 包/分钟
        </span>
      </div>
      <div class="update-time">
        🕐 {{ formatTime(productionStatus.updatedTime) }}
      </div>
    </div>
    <div class="line-status-loading" v-else>
      <span class="loading-dot"></span> 加载产线状态...
    </div>

    <!-- KPI 卡片行 -->
    <div class="kpi-row">
      <div class="kpi-card">
        <div class="kpi-icon">📊</div>
        <div class="kpi-info">
          <span class="kpi-number">{{ detectors.length }}</span>
          <span class="kpi-label">读码器总数</span>
        </div>
        <div class="kpi-unit">台</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon online">●</div>
        <div class="kpi-info">
          <span class="kpi-number">{{ normalRunningCount }}</span>
          <span class="kpi-label">正常运行</span>
        </div>
        <div class="kpi-unit">台</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon fault">!</div>
        <div class="kpi-info">
          <span class="kpi-number">{{ abnormalCount }}</span>
          <span class="kpi-label">异常</span>
        </div>
        <div class="kpi-unit">台</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import ThemeToggle from './ThemeToggle.vue'
import type { ProductionStatus } from '@/types/production'
import { RunStateMap } from '@/types/production'

const props = defineProps<{
  currentTime: string
  currentDate: string
  detectors: any[]
  threshold: { warning: number; danger: number }
  isFullscreen?: boolean
  productionStatus: ProductionStatus | null
}>()

const emit = defineEmits<{
  toggleFullscreen: []
}>()

// 产线列表
const lines = ref([
  { id: 'LINE03', name: 'LINE03', icon: '📦' },
])

const selectedLine = ref('LINE03')

// 计算 KPI 数值
const normalRunningCount = computed(() => props.detectors.filter(d => d.status_code === 3).length)
const abnormalCount = computed(() => props.detectors.length - normalRunningCount.value)

// 产线切换
const onLineChange = () => {}

// 获取运行状态
const getRunStateText = () => {
  if (!props.productionStatus) return '未知'
  return RunStateMap[props.productionStatus.runState]?.text || '未知'
}

const getRunStateClass = () => {
  if (!props.productionStatus) return ''
  return RunStateMap[props.productionStatus.runState]?.color || ''
}

const getRunStateIcon = () => {
  if (!props.productionStatus) return '❓'
  return RunStateMap[props.productionStatus.runState]?.icon || '❓'
}

// 格式化时间
const formatTime = (timeStr: string) => {
  const date = new Date(timeStr)
  return date.toLocaleTimeString('zh-CN', { hour12: false })
}

</script>

<style scoped>
.header-section {
  margin-bottom: 24px;
}

/* 标题栏 */
.title-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-light);
  flex-wrap: wrap;
  gap: 12px;
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-mark {
  width: 32px;
  height: 32px;
  background: var(--primary);
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
  background: #fff;
  border-radius: 50%;
  opacity: 0.8;
}

.logo-area h1 {
  font-size: 28px;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
  letter-spacing: 0;
}

.right-area {
  display: flex;
  align-items: center;
  gap: 20px;
}

/* 产线下拉选择器 */
.line-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-tertiary);
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-light);
}

.selector-icon {
  font-size: 16px;
}

.line-select {
  background: transparent;
  border: none;
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
  cursor: pointer;
  outline: none;
  padding: 4px 0;
}

.line-select option {
  background: var(--bg-card);
  color: var(--text-primary);
}

.datetime-area {
  text-align: right;
}

.fullscreen-toggle {
  flex-shrink: 0;
  border: 1px solid var(--primary);
  background: var(--primary-soft);
  color: var(--primary);
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: var(--transition);
}

.trend-entry {
  flex-shrink: 0;
  border: 1px solid var(--primary);
  background: var(--primary);
  color: var(--text-inverse);
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 15px;
  font-weight: 600;
  text-decoration: none;
  box-shadow: var(--shadow-sm);
  transition: var(--transition);
}

.trend-entry:hover {
  background: var(--primary-soft);
  color: var(--primary);
  box-shadow: var(--shadow-md);
}

.page-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.trend-entry.secondary {
  background: var(--primary-soft);
  color: var(--primary);
}

.trend-entry.secondary:hover {
  background: var(--primary);
  color: var(--text-inverse);
}

.fullscreen-toggle:hover {
  background: var(--primary);
  color: var(--text-inverse);
  box-shadow: var(--shadow-md);
}

.time {
  font-size: 22px;
  font-weight: 600;
  font-family: 'SF Mono', 'JetBrains Mono', monospace;
  color: var(--text-primary);
  line-height: 1.2;
}

.date {
  font-size: 14px;
  color: var(--text-muted);
  margin-top: 2px;
}

/* 产线状态信息行 */
.line-status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 8px 0;
  flex-wrap: wrap;
  gap: 12px;
}

.status-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.status-badge {
  font-size: 14px;
  padding: 4px 12px;
  border-radius: 20px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.status-badge.success {
  background: rgba(45, 106, 79, 0.15);
  color: var(--success);
}

.status-badge.danger {
  background: rgba(220, 53, 69, 0.15);
  color: var(--danger);
}

.status-badge.warning {
  background: rgba(230, 160, 23, 0.15);
  color: var(--warning);
}

.status-badge.idle {
  background: var(--bg-tertiary);
  color: var(--text-muted);
}

.status-badge.speed {
  background: rgba(74, 144, 226, 0.15);
  color: var(--info);
}

.update-time {
  font-size: 13px;
  color: var(--text-muted);
}

.line-status-loading {
  margin-bottom: 20px;
  padding: 8px 0;
  font-size: 14px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 6px;
}

.loading-dot {
  width: 6px;
  height: 6px;
  background: var(--info);
  border-radius: 50%;
  animation: pulse 1s infinite;
}

/* KPI 卡片行 */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1px;
  background: var(--border-light);
  border-radius: 12px;
  overflow: hidden;
}

.kpi-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-card);
  padding: 14px 18px;
}

.kpi-icon {
  font-size: 24px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  border-radius: 8px;
}

.kpi-icon.online { background: rgba(45, 106, 79, 0.15); }
.kpi-icon.warning { background: rgba(230, 160, 23, 0.15); }
.kpi-icon.fault { background: rgba(220, 53, 69, 0.15); }
.kpi-icon.unknown { background: rgba(154, 174, 191, 0.15); }
.kpi-icon.offline { background: rgba(173, 181, 189, 0.15); }
.kpi-icon.connecting { background: rgba(74, 144, 226, 0.15); }
.kpi-icon.maintenance { background: var(--primary-soft); }

.kpi-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.kpi-number {
  font-size: 30px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
}

.kpi-label {
  font-size: 15px;
  color: var(--text-muted);
  margin-top: 4px;
}

.kpi-unit {
  font-size: 15px;
  color: var(--text-muted);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* 响应式 */
@media (max-width: 1000px) {
  .title-bar {
    flex-direction: column;
    align-items: flex-start;
  }
  .right-area {
    width: 100%;
    justify-content: space-between;
  }
  .kpi-row {
    flex-wrap: wrap;
  }
  .kpi-card {
    min-width: calc(50% - 0.5px);
  }
}

@media (max-width: 768px) {
  .logo-area h1 {
    font-size: 24px;
  }
  .time {
    font-size: 20px;
  }
  .line-status-row {
    flex-direction: column;
    align-items: flex-start;
  }
  .kpi-card {
    min-width: 100%;
  }
}
</style>
