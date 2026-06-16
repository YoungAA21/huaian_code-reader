<template>
  <div v-if="visible && point" class="io-history-overlay" @click="emit('close')">
    <section class="io-history-modal" @click.stop>
      <header class="modal-header">
        <div>
          <p class="eyebrow">IO 点位波动</p>
          <h2>{{ point.address }} · {{ point.name }}</h2>
          <span>点位 {{ point.point }} / 数组索引 {{ point.point - 1 }}</span>
        </div>
        <button type="button" class="close-button" aria-label="关闭" @click="emit('close')">×</button>
      </header>

      <div class="query-bar">
        <label>
          <span>开始时间</span>
          <input v-model="startTimeInput" type="datetime-local" step="1" />
        </label>
        <label>
          <span>结束时间</span>
          <input v-model="endTimeInput" type="datetime-local" step="1" />
        </label>
        <button type="button" :disabled="loading" @click="loadHistory">
          {{ loading ? '查询中...' : '查询波动' }}
        </button>
      </div>

      <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>

      <div class="summary-grid">
        <div class="summary-card">
          <span>当前状态</span>
          <strong :class="currentState ? 'on' : 'off'">{{ currentState ? 'ON' : 'OFF' }}</strong>
        </div>
        <div class="summary-card">
          <span>采样数量</span>
          <strong>{{ chartPoints.length }}</strong>
        </div>
        <div class="summary-card">
          <span>状态变化</span>
          <strong>{{ transitionCount }} 次</strong>
        </div>
        <div class="summary-card">
          <span>ON 占比</span>
          <strong>{{ onRatio }}</strong>
        </div>
      </div>

      <div class="chart-panel">
        <div v-if="loading" class="chart-empty">正在加载历史数据...</div>
        <div v-else-if="chartPoints.length === 0" class="chart-empty">所选时间范围暂无快照数据</div>
        <svg v-else viewBox="0 0 900 300" class="io-chart" role="img">
          <rect x="72" y="42" width="782" height="90" class="on-zone" />
          <rect x="72" y="168" width="782" height="90" class="off-zone" />

          <line x1="72" y1="87" x2="854" y2="87" class="state-grid on" />
          <line x1="72" y1="213" x2="854" y2="213" class="state-grid off" />
          <line x1="72" y1="258" x2="854" y2="258" class="axis-line" />

          <text x="55" y="92" text-anchor="end" class="state-label on">ON</text>
          <text x="55" y="218" text-anchor="end" class="state-label off">OFF</text>

          <path :d="stepPath" class="state-path-shadow" />
          <path :d="stepPath" class="state-path" />

          <g v-for="change in changePoints" :key="change.key">
            <line :x1="change.x" y1="42" :x2="change.x" y2="258" class="change-line" />
            <circle :cx="change.x" :cy="change.y" r="6" :class="change.active ? 'change-dot on' : 'change-dot off'">
              <title>{{ change.tooltip }}</title>
            </circle>
          </g>

          <text x="72" y="284" class="time-label">{{ firstTimeLabel }}</text>
          <text x="854" y="284" text-anchor="end" class="time-label">{{ lastTimeLabel }}</text>
        </svg>
      </div>

      <div v-if="changePoints.length > 0" class="change-list">
        <div class="change-list-head">
          <strong>状态变化记录</strong>
          <span>共 {{ changePoints.length }} 次</span>
        </div>
        <div class="change-items">
          <div v-for="change in changePoints" :key="`row-${change.key}`" class="change-item">
            <time>{{ change.timeText }}</time>
            <span class="direction">{{ change.active ? 'OFF → ON' : 'ON → OFF' }}</span>
            <span :class="change.active ? 'state-chip on' : 'state-chip off'">
              {{ change.active ? 'ON' : 'OFF' }}
            </span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { productionApi } from '@/api/production'
import type { ProductionSnapshot } from '@/types/production'

export interface IoPoint {
  point: number
  address: string
  name: string
  active: boolean
}

const props = defineProps<{
  visible: boolean
  point: IoPoint | null
}>()

const emit = defineEmits<{
  close: []
}>()

interface IoChartPoint {
  id: number
  timestamp: number
  time: string
  active: boolean
  x: number
  y: number
}

const loading = ref(false)
const errorMessage = ref('')
const snapshots = ref<ProductionSnapshot[]>([])
const startTimeInput = ref('')
const endTimeInput = ref('')

const formatInputDate = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
      `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

const resetTimeRange = () => {
  const end = new Date()
  const start = new Date(end.getTime() - 30 * 60 * 1000)
  startTimeInput.value = formatInputDate(start)
  endTimeInput.value = formatInputDate(end)
}

const getSignalValue = (snapshot: ProductionSnapshot, point: number) => {
  const index = point - 1
  if (Array.isArray(snapshot.ioSignals) && index < snapshot.ioSignals.length) {
    return Boolean(snapshot.ioSignals[index])
  }

  if (Number.isFinite(snapshot.ioStatusBits)) {
    return Math.floor(snapshot.ioStatusBits / 2 ** index) % 2 === 1
  }

  return false
}

const chartPoints = computed<IoChartPoint[]>(() => {
  if (!props.point) return []

  const ordered = snapshots.value
      .map(snapshot => ({
        snapshot,
        timestamp: new Date(snapshot.time).getTime()
      }))
      .filter(item => Number.isFinite(item.timestamp))
      .sort((a, b) => a.timestamp - b.timestamp)

  if (ordered.length === 0) return []

  const first = ordered[0].timestamp
  const last = ordered[ordered.length - 1].timestamp
  const duration = Math.max(last - first, 1)

  return ordered.map(({ snapshot, timestamp }) => {
    const active = getSignalValue(snapshot, props.point!.point)
    return {
      id: snapshot.id,
      timestamp,
      time: snapshot.time,
      active,
      x: 72 + ((timestamp - first) / duration) * 782,
      y: active ? 87 : 213
    }
  })
})

const stepPath = computed(() => {
  const points = chartPoints.value
  if (points.length === 0) return ''

  return points.slice(1).reduce(
      (path, point) => `${path} H ${point.x} V ${point.y}`,
      `M ${points[0].x} ${points[0].y}`
  )
})

const changePoints = computed(() => chartPoints.value
    .filter((point, index, points) => index > 0 && point.active !== points[index - 1].active)
    .map(point => ({
      ...point,
      key: `${point.id}-${point.timestamp}`,
      timeText: new Date(point.time).toLocaleString('zh-CN', { hour12: false }),
      tooltip: `${new Date(point.time).toLocaleString('zh-CN', { hour12: false })}\n${point.active ? 'OFF → ON' : 'ON → OFF'}`
    })))

const transitionCount = computed(() => changePoints.value.length)
const currentState = computed(() => chartPoints.value.at(-1)?.active ?? props.point?.active ?? false)
const onRatio = computed(() => {
  if (chartPoints.value.length === 0) return '--'
  const onCount = chartPoints.value.filter(point => point.active).length
  return `${((onCount / chartPoints.value.length) * 100).toFixed(1)}%`
})

const firstTimeLabel = computed(() => {
  const point = chartPoints.value[0]
  return point ? new Date(point.time).toLocaleString('zh-CN', { hour12: false }) : ''
})

const lastTimeLabel = computed(() => {
  const point = chartPoints.value.at(-1)
  return point ? new Date(point.time).toLocaleString('zh-CN', { hour12: false }) : ''
})

const loadHistory = async () => {
  if (!props.point) return

  const start = new Date(startTimeInput.value)
  const end = new Date(endTimeInput.value)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    errorMessage.value = '请选择有效的开始和结束时间'
    return
  }
  if (start >= end) {
    errorMessage.value = '开始时间必须早于结束时间'
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    const response = await productionApi.getProductionSnapshots({
      startTime: startTimeInput.value,
      endTime: endTimeInput.value,
      limit: 10000
    })
    snapshots.value = response.items || []
  } catch (error) {
    console.error(`查询 IO 点位 ${props.point.point} 历史失败:`, error)
    snapshots.value = []
    errorMessage.value = '历史数据查询失败，请检查接口服务'
  } finally {
    loading.value = false
  }
}

watch(
    () => [props.visible, props.point?.point] as const,
    ([visible]) => {
      if (!visible || !props.point) return
      snapshots.value = []
      resetTimeRange()
      loadHistory()
    }
)
</script>

<style scoped>
.io-history-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(8, 15, 24, 0.64);
  backdrop-filter: blur(4px);
}

.io-history-modal {
  width: min(1040px, 96vw);
  max-height: 92vh;
  overflow-y: auto;
  padding: 22px;
  border: 1px solid var(--border-light);
  border-radius: 14px;
  background: var(--bg-primary);
  box-shadow: var(--shadow-lg);
  color: var(--text-primary);
}

.modal-header,
.query-bar,
.summary-grid,
.change-list-head,
.change-item {
  display: flex;
  align-items: center;
}

.modal-header {
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 18px;
}

.eyebrow {
  margin: 0 0 4px;
  color: var(--primary);
  font-size: 13px;
  font-weight: 800;
}

.modal-header h2 {
  margin: 0 0 5px;
  font-size: 24px;
}

.modal-header span {
  color: var(--text-muted);
  font-size: 12px;
}

.close-button {
  width: 38px;
  height: 38px;
  border: 1px solid var(--border-medium);
  border-radius: 50%;
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 24px;
  line-height: 1;
}

.query-bar {
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--border-light);
  border-radius: 10px;
  background: var(--bg-card);
}

.query-bar label {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
}

.query-bar input {
  width: 100%;
  min-height: 38px;
  padding: 7px 10px;
  border: 1px solid var(--border-medium);
  border-radius: 7px;
  outline: none;
  background: var(--bg-secondary);
  color: var(--text-primary);
  color-scheme: inherit;
}

.query-bar input:focus {
  border-color: var(--primary);
}

.query-bar button {
  align-self: flex-end;
  min-height: 38px;
  padding: 0 18px;
  border: 1px solid var(--primary);
  border-radius: 7px;
  background: var(--primary);
  color: var(--text-inverse);
  cursor: pointer;
  font-weight: 800;
}

.query-bar button:disabled {
  cursor: wait;
  opacity: 0.65;
}

.error-message {
  margin-top: 10px;
  color: var(--danger);
  font-size: 13px;
  font-weight: 700;
}

.summary-grid {
  gap: 10px;
  margin: 14px 0;
}

.summary-card {
  flex: 1;
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid var(--border-light);
  border-radius: 9px;
  background: var(--bg-card);
}

.summary-card span {
  display: block;
  margin-bottom: 4px;
  color: var(--text-muted);
  font-size: 12px;
}

.summary-card strong {
  font-size: 18px;
}

.on {
  color: var(--success);
}

.off {
  color: var(--danger);
}

.chart-panel {
  min-height: 330px;
  padding: 14px;
  border: 1px solid var(--border-light);
  border-radius: 10px;
  background: var(--bg-card);
}

.chart-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  color: var(--text-muted);
}

.io-chart {
  display: block;
  width: 100%;
  min-width: 700px;
}

.on-zone {
  fill: rgba(45, 106, 79, 0.07);
}

.off-zone {
  fill: rgba(220, 53, 69, 0.05);
}

.state-grid {
  stroke-width: 1.5;
  stroke-dasharray: 5 5;
}

.state-grid.on {
  stroke: rgba(45, 106, 79, 0.5);
}

.state-grid.off {
  stroke: rgba(220, 53, 69, 0.45);
}

.axis-line {
  stroke: var(--border-medium);
}

.state-label,
.time-label {
  fill: var(--text-muted);
  font-family: 'SF Mono', 'JetBrains Mono', monospace;
  font-size: 12px;
}

.state-label {
  font-size: 13px;
  font-weight: 900;
}

.state-label.on {
  fill: var(--success);
}

.state-label.off {
  fill: var(--danger);
}

.state-path-shadow,
.state-path {
  fill: none;
  stroke-linejoin: round;
}

.state-path-shadow {
  stroke: var(--bg-card);
  stroke-width: 8;
}

.state-path {
  stroke: var(--primary);
  stroke-width: 4;
}

.change-line {
  stroke: var(--warning);
  stroke-width: 1;
  stroke-dasharray: 3 4;
  opacity: 0.7;
}

.change-dot {
  stroke: var(--bg-card);
  stroke-width: 3;
}

.change-dot.on {
  fill: var(--success);
}

.change-dot.off {
  fill: var(--danger);
}

.change-list {
  margin-top: 14px;
  padding: 14px;
  border: 1px solid var(--border-light);
  border-radius: 10px;
  background: var(--bg-card);
}

.change-list-head {
  justify-content: space-between;
  margin-bottom: 9px;
}

.change-list-head span {
  color: var(--text-muted);
  font-size: 12px;
}

.change-items {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
  max-height: 160px;
  overflow-y: auto;
}

.change-item {
  gap: 10px;
  padding: 8px 10px;
  border-radius: 7px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 12px;
}

.change-item time {
  flex: 1;
  font-family: 'SF Mono', 'JetBrains Mono', monospace;
}

.direction {
  color: var(--text-muted);
}

.state-chip {
  min-width: 38px;
  padding: 3px 6px;
  border-radius: 999px;
  text-align: center;
  font-weight: 900;
}

.state-chip.on {
  background: rgba(45, 106, 79, 0.12);
}

.state-chip.off {
  background: rgba(220, 53, 69, 0.1);
}

@media (max-width: 760px) {
  .io-history-overlay {
    padding: 10px;
  }

  .query-bar,
  .summary-grid {
    align-items: stretch;
    flex-direction: column;
  }

  .chart-panel {
    overflow-x: auto;
  }

  .change-items {
    grid-template-columns: 1fr;
  }
}
</style>
