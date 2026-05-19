<template>
  <div class="header-section">
    <div class="title-bar">
      <div class="logo-area">
        <div class="logo-mark"></div>
        <h1>卷包车间检测监控中心</h1>
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
        <ThemeToggle />
        <div class="datetime-area">
          <div class="time">{{ currentTime }}</div>
          <div class="date">{{ currentDate }}</div>
        </div>
      </div>
    </div>

    <!-- 产线状态信息行 -->
    <div class="line-status-row" v-if="productionStatus">
      <div class="status-badges">
        <span class="status-badge" :class="getRunStateClass()">
          {{ getRunStateIcon() }} {{ getRunStateText() }}
        </span>
        <span class="status-badge" :class="productionStatus.emergencyStop ? 'danger' : 'success'">
          {{ productionStatus.emergencyStop ? '🛑 急停中' : '✅ 正常' }}
        </span>
        <span class="status-badge" :class="productionStatus.isProductionRunning ? 'success' : 'idle'">
          {{ productionStatus.isProductionRunning ? '▶️ 生产中' : '⏸️ 待产中' }}
        </span>
        <span class="status-badge speed">
          ⚡ 速度: {{ productionStatus.speed }} 个/分钟
        </span>
      </div>
      <div class="update-time">
        🕐 {{ formatTime(productionStatus.updatedTime) }}
      </div>
    </div>
    <div class="line-status-loading" v-else-if="loading">
      <span class="loading-dot"></span> 加载产线状态...
    </div>

    <!-- KPI 卡片行 -->
    <div class="kpi-row">
      <div class="kpi-card">
        <div class="kpi-icon">📊</div>
        <div class="kpi-info">
          <span class="kpi-number">{{ detectors.length }}</span>
          <span class="kpi-label">检测器总数</span>
        </div>
        <div class="kpi-unit">台</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon online">🟢</div>
        <div class="kpi-info">
          <span class="kpi-number">{{ onlineCount }}</span>
          <span class="kpi-label">在线数量</span>
        </div>
        <div class="kpi-unit">台</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon warning">⚠️</div>
        <div class="kpi-info">
          <span class="kpi-number">{{ warningCount }}</span>
          <span class="kpi-label">警告</span>
        </div>
        <div class="kpi-unit">台</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon danger">🔴</div>
        <div class="kpi-info">
          <span class="kpi-number">{{ dangerCount }}</span>
          <span class="kpi-label">危险</span>
        </div>
        <div class="kpi-unit">台</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import ThemeToggle from './ThemeToggle.vue'
import { productionApi } from '@/api/production'
import type { ProductionStatus } from '@/types/production'
import { RunStateMap } from '@/types/production'

const props = defineProps<{
  currentTime: string
  currentDate: string
  detectors: any[]
  threshold: { warning: number; danger: number }
}>()

// 产线列表
const lines = ref([
  { id: 'LINE01', name: '产线一', icon: '🔧' },
  { id: 'LINE02', name: '产线二', icon: '🔨' },
  { id: 'LINE03', name: '产线三', icon: '⚙️' },
  { id: 'LINE04', name: '产线四', icon: '📦' },
])

const selectedLine = ref('LINE01')
const productionStatus = ref<ProductionStatus | null>(null)
const loading = ref(false)

let refreshInterval: any

// 计算 KPI 数值
const onlineCount = computed(() => props.detectors.filter(d => d.isConnected).length)
const warningCount = computed(() => props.detectors.filter(d =>
    d.displayValue >= props.threshold.warning && d.displayValue < props.threshold.danger
).length)
const dangerCount = computed(() => props.detectors.filter(d =>
    d.displayValue >= props.threshold.danger
).length)

// 产线切换
const onLineChange = () => {
  fetchProductionStatus()
}

// 获取生产状态
const fetchProductionStatus = async () => {
  try {
    loading.value = true
    productionStatus.value = await productionApi.getProductionStatus()
  } catch (err: any) {
    console.error('获取生产状态失败:', err)
  } finally {
    loading.value = false
  }
}

// 获取运行状态
const getRunStateText = () => {
  if (!productionStatus.value) return '未知'
  return RunStateMap[productionStatus.value.runState]?.text || '未知'
}

const getRunStateClass = () => {
  if (!productionStatus.value) return ''
  return RunStateMap[productionStatus.value.runState]?.color || ''
}

const getRunStateIcon = () => {
  if (!productionStatus.value) return '❓'
  return RunStateMap[productionStatus.value.runState]?.icon || '❓'
}

// 格式化时间
const formatTime = (timeStr: string) => {
  const date = new Date(timeStr)
  return date.toLocaleTimeString('zh-CN', { hour12: false })
}

// 启动定时刷新
const startRefresh = () => {
  refreshInterval = setInterval(fetchProductionStatus, 5000)
}

onMounted(() => {
  fetchProductionStatus()
  startRefresh()
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})
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
  display: flex;
  gap: 1px;
  background: var(--border-light);
  border-radius: 12px;
  overflow: hidden;
}

.kpi-card {
  flex: 1;
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
.kpi-icon.danger { background: rgba(220, 53, 69, 0.15); }

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
