<!-- DetectorGrid.vue - 修改部分 -->
<template>
  <div class="detector-grid">
    <div class="grid-header">
      <div class="title-area">
        <span class="title-mark"></span>
        <h3>设备状态</h3>
      </div>
      <div class="legend-area">
        <span class="legend-item"><span class="dot normal"></span>正常</span>
        <span class="legend-item"><span class="dot warning"></span>警告</span>
        <span class="legend-item"><span class="dot danger"></span>危险</span>
        <span class="legend-item"><span class="dot offline"></span>离线</span>
      </div>
    </div>

    <div class="grid-container">
      <div
          v-for="detector in detectors"
          :key="detector.id"
          class="device-card"
          :data-status="getCardStatus(detector)"
      >
        <!-- 头部 -->
        <div class="card-header">
          <div class="device-info">
            <div class="device-name">{{ detector.name }}</div>
            <div class="device-id">{{ detector.id }}</div>
          </div>
          <div class="header-actions">
            <button
                class="config-btn"
                @click.stop="$emit('config-threshold', detector)"
                title="配置阈值"
            >
              ⚙️
            </button>
            <div class="status-dot" :class="getDotClass(detector)"></div>
          </div>
        </div>

        <!-- 数值区域 -->
        <div class="value-area" @click="$emit('openDetail', detector)">
          <span class="value-number" :class="getValueClass(detector)">{{ detector.displayValue.toFixed(0) }}</span>
          <span class="value-unit">ms</span>
          <span class="value-trend" :class="detector.trend > 0 ? 'trend-up' : 'trend-down'">
            {{ detector.trend > 0 ? '↑' : '↓' }} {{ Math.abs(detector.trend).toFixed(1) }}
          </span>
        </div>

        <!-- 温度 -->
        <div class="temp-area" :class="getTempClass(detector)" @click="$emit('openDetail', detector)">
          <span class="temp-icon">🌡</span>
          <span class="temp-value">{{ (detector.temperature || 0).toFixed(1) }}</span>
          <span class="temp-unit">°C</span>
        </div>

        <!-- 趋势图 -->
        <div class="chart-area" @click="$emit('openDetail', detector)">
          <canvas :ref="setCanvasRef(detector.id)" class="trend-canvas"></canvas>
        </div>

        <!-- 底部统计 -->
        <div class="footer-stats" @click="$emit('openDetail', detector)">
          <div class="stat">
            <span class="stat-label">总耗时</span>
            <strong class="stat-value">{{ (detector.lastTotalTime || 0).toFixed(0) }}ms</strong>
          </div>
          <div class="stat">
            <span class="stat-label">触发序号</span>
            <strong class="stat-value">{{ detector.lastTriggerIndex || 0 }}</strong>
          </div>
          <div class="stat">
            <span class="stat-label">点位</span>
            <strong class="stat-value station">{{ detector.stationName || '--' }}</strong>
          </div>
        </div>

        <div class="update-time" @click="$emit('openDetail', detector)">{{ detector.lastUpdateTime || '--:--:--' }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{
  detectors: any[]
  threshold: { warning: number; danger: number }
}>()

const emit = defineEmits<{
  openDetail: [detector: any]
  'config-threshold': [detector: any]
}>()

// 获取设备的自定义阈值，如果没有则使用全局阈值
const getDetectorThreshold = (detector: any) => {
  return detector.customThreshold || props.threshold
}

const getDetectorTempThreshold = (detector: any) => {
  return detector.customTempThreshold || { warning: 45, danger: 60 }
}

const TEMP_THRESHOLD = { warning: 45, danger: 60 } // 全局默认值，实际会被覆盖
const canvasMap = new Map<string, HTMLCanvasElement>()
const animationMap = new Map<string, number>()

const setCanvasRef = (id: string) => (el: any) => {
  if (el) canvasMap.set(id, el)
}

const drawChart = (detector: any, canvas: HTMLCanvasElement) => {
  if (!detector.trendData || !detector.trendData.length) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  if (animationMap.has(detector.id)) cancelAnimationFrame(animationMap.get(detector.id)!)

  const id = requestAnimationFrame(() => {
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight
    const width = canvas.width, height = canvas.height

    ctx.clearRect(0, 0, width, height)

    if (detector.trendData.length < 2) return

    const values = detector.trendData
    const maxTime = Math.max(...values, 1)
    const minTime = Math.min(...values, 0)
    const range = Math.max(maxTime - minTime, 1)

    const stepX = width / (values.length - 1)

    ctx.beginPath()
    ctx.lineWidth = 1.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const threshold = getDetectorThreshold(detector)
    if (detector.displayValue >= threshold.danger) ctx.strokeStyle = '#dc3545'
    else if (detector.displayValue >= threshold.warning) ctx.strokeStyle = '#e6a017'
    else ctx.strokeStyle = '#2d6a4f'

    values.forEach((val: number, i: number) => {
      const x = i * stepX
      const y = height - ((val - minTime) / range) * height
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()
  })
  animationMap.set(detector.id, id)
}

const getCardStatus = (d: any) => {
  if (!d.isConnected) return d.status === 'NO_READ' ? 'warning' : 'offline'
  const threshold = getDetectorThreshold(d)
  if (d.displayValue >= threshold.danger) return 'danger'
  if (d.displayValue >= threshold.warning) return 'warning'
  return 'normal'
}

const getDotClass = (d: any) => {
  if (!d.isConnected) return d.status === 'NO_READ' ? 'warning' : 'offline'
  const threshold = getDetectorThreshold(d)
  if (d.displayValue >= threshold.danger) return 'danger'
  if (d.displayValue >= threshold.warning) return 'warning'
  return 'normal'
}

const getValueClass = (d: any) => {
  const threshold = getDetectorThreshold(d)
  if (d.displayValue >= threshold.danger) return 'danger'
  if (d.displayValue >= threshold.warning) return 'warning'
  return ''
}

const getTempClass = (d: any) => {
  const temp = d.temperature || 0
  const tempThreshold = getDetectorTempThreshold(d)
  if (temp >= tempThreshold.danger) return 'danger'
  if (temp >= tempThreshold.warning) return 'warning'
  return 'normal'
}

watch(() => props.detectors, () => {
  props.detectors.forEach(d => {
    const canvas = canvasMap.get(d.id)
    if (canvas) drawChart(d, canvas)
  })
}, { deep: true })

onMounted(() => {
  setTimeout(() => {
    props.detectors.forEach(d => {
      const canvas = canvasMap.get(d.id)
      if (canvas) drawChart(d, canvas)
    })
  }, 100)
})

onUnmounted(() => {
  animationMap.forEach(id => cancelAnimationFrame(id))
  animationMap.clear()
})
</script>

<style scoped>
.detector-grid {
  margin-bottom: 80px;
}

.grid-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 0 4px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.config-btn {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  transition: all 0.2s ease;
  opacity: 0.6;
}

.config-btn:hover {
  opacity: 1;
  background: var(--bg-tertiary);
  transform: rotate(15deg);
}

.title-area {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-mark {
  width: 3px;
  height: 16px;
  background: var(--success);
  border-radius: 2px;
}

.title-area h3 {
  font-size: 20px;
  font-weight: 500;
  margin: 0;
  color: var(--text-muted);
}

.legend-area {
  display: flex;
  gap: 16px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  color: var(--text-muted);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot.normal { background: var(--success); }
.dot.warning { background: var(--warning); }
.dot.danger { background: var(--danger); }
.dot.offline { background: var(--border-heavy); }

.grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.device-card {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: var(--transition);
  border: 1px solid var(--border-light);
}

.device-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--border-medium);
}

/* 状态边框 */
.device-card[data-status="normal"] { border-top: 3px solid var(--success); }
.device-card[data-status="warning"] { border-top: 3px solid var(--warning); }
.device-card[data-status="danger"] { border-top: 3px solid var(--danger); }
.device-card[data-status="offline"] { border-top: 3px solid var(--border-heavy); opacity: 0.7; }

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.device-name {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.device-id {
  font-size: 15px;
  color: var(--text-muted);
  font-family: monospace;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 4px;
}

.status-dot.normal { background: var(--success); }
.status-dot.warning { background: var(--warning); animation: pulse-warning 1.5s infinite; }
.status-dot.danger { background: var(--danger); animation: pulse-danger 1s infinite; }
.status-dot.offline { background: var(--border-heavy); }

@keyframes pulse-warning {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
@keyframes pulse-danger {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.value-area {
  text-align: center;
  margin-bottom: 8px;
}

.value-number {
  font-size: 52px;
  font-weight: 700;
  font-family: 'SF Mono', 'JetBrains Mono', monospace;
  color: var(--text-primary);
}

.value-number.danger { color: var(--danger); }
.value-number.warning { color: var(--warning); }

.value-unit {
  font-size: 16px;
  color: var(--text-muted);
  margin-left: 4px;
}

.value-trend {
  font-size: 15px;
  margin-left: 8px;
}

.trend-up { color: var(--danger); }
.trend-down { color: var(--success); }

.temp-area {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  margin: 8px 0 12px;
  border-radius: 20px;
  background: var(--bg-tertiary);
  font-size: 17px;
}

.temp-area.normal { color: var(--success); }
.temp-area.warning { color: var(--warning); background: rgba(230, 160, 23, 0.1); }
.temp-area.danger { color: var(--danger); background: rgba(220, 53, 69, 0.1); }

.temp-value {
  font-size: 22px;
  font-weight: 600;
  font-family: monospace;
}

.chart-area {
  margin: 12px 0;
}

.trend-canvas {
  width: 100%;
  height: 40px;
  border-radius: 6px;
  background: var(--bg-tertiary);
}

.footer-stats {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  border-top: 1px solid var(--border-light);
  margin-bottom: 8px;
}

.stat {
  text-align: center;
  flex: 1;
}

.stat-label {
  display: block;
  font-size: 17px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary);
}

.stat-value.station {
  font-size: 17px;
  word-break: break-all;
}

.update-time {
  font-size: 15px;
  color: var(--text-muted);
  text-align: right;
}

@media (max-width: 768px) {
  .grid-container {
    grid-template-columns: 1fr;
  }
  .grid-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
}
</style>