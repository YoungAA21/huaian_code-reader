<template>
  <div class="detector-grid">
    <div class="grid-header">
      <div class="title">
        <span class="title-icon"></span>
        <h2>检测器状态矩阵</h2>
      </div>
      <div class="legend">
        <span><i class="dot green"></i>正常</span>
        <span><i class="dot yellow"></i>警告</span>
        <span><i class="dot red"></i>危险</span>
        <span><i class="dot gray"></i>离线</span>
      </div>
    </div>

    <div class="grid-container">
      <div
          v-for="detector in detectors"
          :key="detector.id"
          class="detector-card"
          :class="getCardClass(detector)"
          @click="$emit('openDetail', detector)"
      >
        <div class="card-header">
          <div>
            <div class="name">{{ detector.name }}</div>
            <div class="id">{{ detector.id }}</div>
          </div>
          <div class="status-light" :class="getLightClass(detector)"></div>
        </div>

        <div class="value">
          <span class="number" :class="getValueClass(detector)">{{ detector.displayValue.toFixed(0) }}</span>
          <span class="unit">ms</span>
          <span class="trend" :class="detector.trend > 0 ? 'up' : 'down'">
            {{ detector.trend > 0 ? '▲' : '▼' }} {{ Math.abs(detector.trend).toFixed(1) }}
          </span>
        </div>

        <div class="mini-chart">
          <canvas :ref="setCanvasRef(detector.id)" class="mini-canvas"></canvas>
        </div>

        <!-- 底部统计：总耗时、触发序号、点位名称 -->
        <div class="stats">
          <div>
            <span>总耗时</span>
            <strong>{{ (detector.lastTotalTime || 0).toFixed(0) }}ms</strong>
          </div>
          <div>
            <span>触发序号</span>
            <strong>{{ detector.lastTriggerIndex || 0 }}</strong>
          </div>
          <div>
            <span>点位名称</span>
            <strong class="station-name">{{ detector.stationName || '--' }}</strong>
          </div>
        </div>

        <div class="update-time">{{ detector.lastUpdateTime || '--:--:--' }}</div>
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

defineEmits<{ openDetail: [detector: any] }>()

const canvasMap = new Map<string, HTMLCanvasElement>()
const animationMap = new Map<string, number>()

const setCanvasRef = (id: string) => (el: any) => {
  if (el) canvasMap.set(id, el)
}

// 绘制波动图（使用真实 totalTime 数据）
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
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.fillRect(0, 0, width, height)

    const stepX = width / 30
    const startX = width - (detector.trendData.length * stepX)

    // 动态计算最小值和最大值，让波动更明显
    const values = detector.trendData
    const maxTime = Math.max(...values, 1)
    const minTime = Math.min(...values, 0)
    const range = maxTime - minTime

    // 如果数据波动很小（比如 67±2），就用最小显示范围 10ms 来放大波动
    const displayRange = range > 1 ? range : 3

    ctx.beginPath()
    if (detector.displayValue >= props.threshold.danger) ctx.strokeStyle = '#ff4444'
    else if (detector.displayValue >= props.threshold.warning) ctx.strokeStyle = '#ffaa00'
    else ctx.strokeStyle = '#00ff88'
    ctx.lineWidth = 2

    values.forEach((val: number, i: number) => {
      const x = startX + i * stepX
      // 基于最小值和显示范围计算 Y 位置
      const normalizedY = ((val - minTime) / displayRange) * 100
      const y = height - (Math.min(100, Math.max(0, normalizedY)) / 100) * height
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()
  })
  animationMap.set(detector.id, id)
}

const getCardClass = (d: any) => {
  // 根据状态返回不同样式
  if (!d.isConnected) {
    if (d.status === 'NO_READ') return 'warning'  // NO_READ 显示为警告样式
    return 'offline'
  }
  if (d.displayValue >= props.threshold.danger) return 'danger'
  if (d.displayValue >= props.threshold.warning) return 'warning'
  return 'normal'
}

const getLightClass = (d: any) => {
  if (!d.isConnected) {
    if (d.status === 'NO_READ') return 'warning'
    return 'offline'
  }
  if (d.displayValue >= props.threshold.danger) return 'danger'
  if (d.displayValue >= props.threshold.warning) return 'warning'
  return 'normal'
}

const getValueClass = (d: any) => {
  if (d.displayValue >= props.threshold.danger) return 'danger'
  if (d.displayValue >= props.threshold.warning) return 'warning'
  return ''
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
.detector-grid { position: relative; z-index: 10; margin-bottom: 100px; }

.grid-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;
}
.title { display: flex; align-items: center; gap: 12px; }
.title-icon { width: 5px; height: 24px; background: linear-gradient(180deg, #00ff88, #00aa55); border-radius: 3px; }
.title h2 { font-size: 22px; font-weight: 500; margin: 0; color: #fff; }
.legend { display: flex; gap: 20px; font-size: 15px; color: #88aabb; }
.legend .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; }
.dot.green { background: #00ff88; box-shadow: 0 0 4px #00ff88; }
.dot.yellow { background: #ffaa00; box-shadow: 0 0 4px #ffaa00; }
.dot.red { background: #ff4444; box-shadow: 0 0 4px #ff4444; }
.dot.gray { background: #666; }

.grid-container {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 24px;
}

.detector-card {
  background: linear-gradient(135deg, rgba(15,25,35,0.9), rgba(8,15,22,0.95));
  backdrop-filter: blur(10px); border-radius: 20px; padding: 20px;
  border: 1px solid rgba(0,255,136,0.2); cursor: pointer; transition: all 0.3s;
}
.detector-card:hover { transform: translateY(-2px); border-color: rgba(0,255,136,0.5); }
.detector-card.normal { border-top: 4px solid #00ff88; }
.detector-card.warning { border-top: 4px solid #ffaa00; background: linear-gradient(135deg, rgba(50,40,20,0.9), rgba(30,25,15,0.95)); }
.detector-card.danger { border-top: 4px solid #ff4444; background: linear-gradient(135deg, rgba(50,25,25,0.9), rgba(35,15,15,0.95)); animation: pulse 1s infinite; }
.detector-card.offline { border-top: 4px solid #666; opacity: 0.6; }

@keyframes pulse {
  0%, 100% { border-top-color: #ff4444; }
  50% { border-top-color: #ff8888; }
}

.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.name { font-size: 20px; font-weight: 600; color: #fff; }
.id { font-size: 13px; color: #88aabb; margin-top: 4px; }

.status-light { width: 12px; height: 12px; border-radius: 50%; }
.status-light.normal { background: #00ff88; box-shadow: 0 0 6px #00ff88; }
.status-light.warning { background: #ffaa00; box-shadow: 0 0 6px #ffaa00; animation: blink 1s infinite; }
.status-light.danger { background: #ff4444; box-shadow: 0 0 6px #ff4444; animation: blink 0.5s infinite; }
.status-light.offline { background: #666; }
@keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

.value { text-align: center; margin-bottom: 16px; }
.value .number { font-size: 44px; font-weight: bold; font-family: monospace; }
.value .number.danger { color: #ff4444; text-shadow: 0 0 10px rgba(255,68,68,0.5); }
.value .number.warning { color: #ffaa00; text-shadow: 0 0 10px rgba(255,170,0,0.5); }
.value .number:not(.danger):not(.warning) { color: #00ff88; text-shadow: 0 0 10px rgba(0,255,136,0.5); }
.value .unit { font-size: 16px; color: #88aabb; margin: 0 10px; }
.value .trend { font-size: 16px; margin-left: 6px; }
.trend.up { color: #ff4444; }
.trend.down { color: #00ff88; }

.mini-chart { margin-bottom: 16px; }
.mini-canvas { width: 100%; height: 50px; border-radius: 8px; background: rgba(0,0,0,0.3); }

.stats {
  display: flex;
  justify-content: space-around;
  padding: 12px 0;
  border-top: 1px solid rgba(0,255,136,0.1);
  border-bottom: 1px solid rgba(0,255,136,0.1);
  margin-bottom: 10px;
}
.stats div {
  text-align: center;
  flex: 1;
}
.stats span {
  display: block;
  font-size: 13px;
  color: #88aabb;
  margin-bottom: 6px;
}
.stats strong {
  font-size: 16px;
  color: #fff;
  word-break: break-all;
}
.stats strong.station-name {
  font-size: 14px;
}

.update-time { font-size: 13px; color: #666; text-align: right; }

@media (max-width: 768px) {
  .grid-container { grid-template-columns: 1fr; }
  .grid-header { flex-direction: column; align-items: flex-start; gap: 14px; }
}
</style>