<template>
  <div class="trend-chart">
    <div class="chart-head">
      <div>
        <h3>{{ readerId }}</h3>
        <p>{{ pointCount }} 条记录</p>
      </div>
      <div class="legend">
        <span><i class="temp"></i>温度</span>
        <span><i class="decode"></i>解码耗时</span>
        <span><i class="speed"></i>车速</span>
        <span><i class="speed-stop"></i>停车</span>
        <span><i class="speed-slow"></i>慢车</span>
        <span><i class="speed-normal"></i>正常</span>
        <span><i class="alarm"></i>告警 {{ alarmMarkers.length }}</span>
      </div>
    </div>

    <div v-if="points.length === 0" class="empty-state">暂无数据</div>
    <div v-else ref="chartStage" class="chart-stage" @mouseleave="hideAlarmTooltip">
      <div class="chart-scroll">
      <svg
          :viewBox="`0 0 ${chartWidth} 340`"
          :style="{ width: `${chartWidth}px` }"
          role="img"
          class="chart-svg"
      >
      <line
          v-for="tick in yTicks"
          :key="tick.y"
          x1="58"
          :y1="tick.y"
          :x2="chartRight"
          :y2="tick.y"
          class="grid-line"
      />
      <line
          v-for="tick in xTicks"
          :key="tick.x"
          :x1="tick.x"
          y1="24"
          :x2="tick.x"
          y2="276"
          class="grid-line x-grid"
      />
      <line x1="58" y1="24" x2="58" y2="276" class="axis-line" />
      <line :x1="chartRight" y1="24" :x2="chartRight" y2="276" class="axis-line soft" />
      <line x1="58" y1="276" :x2="chartRight" y2="276" class="axis-line" />

      <text
          v-for="tick in yTicks"
          :key="`temp-${tick.y}`"
          x="48"
          :y="tick.y + 4"
          text-anchor="end"
          class="axis-label"
      >{{ tick.temp }}</text>
      <text
          v-for="tick in yTicks"
          :key="`right-${tick.y}`"
          :x="chartRight + 10"
          :y="tick.y + 4"
          class="axis-label right-axis-label"
      >{{ tick.right }}</text>

      <g class="speed-band">
        <line x1="58" :x2="chartRight" :y1="speedBandY" :y2="speedBandY" class="speed-track" />
        <line
            v-for="segment in speedSegments"
            :key="segment.key"
            :x1="segment.x1"
            :x2="segment.x2"
            :y1="speedBandY"
            :y2="speedBandY"
            :class="`speed-segment ${segment.level}`"
        >
          <title>{{ segment.title }}</title>
        </line>
        <text x="58" :y="speedBandY - 10" class="speed-band-label">车速状态</text>
      </g>

      <polyline :points="temperaturePath" class="temp-line" />
      <polyline :points="decodePath" class="decode-line" />

      <g
          v-for="marker in alarmMarkers"
          :key="marker.id"
          class="alarm-marker"
          @mouseenter="showAlarmTooltip($event, marker)"
          @mousemove="showAlarmTooltip($event, marker)"
      >
        <rect
            :x="marker.x - 8"
            y="24"
            width="16"
            height="252"
            class="alarm-hit-area"
        />
        <line
            :x1="marker.x"
            y1="24"
            :x2="marker.x"
            y2="276"
            :class="marker.level >= 2 ? 'alarm-guide critical' : 'alarm-guide'"
        />
        <path
            :d="`M ${marker.x} 24 L ${marker.x - 6} 36 L ${marker.x + 6} 36 Z`"
            :class="marker.level >= 2 ? 'alarm-symbol critical' : 'alarm-symbol'"
        />
      </g>

      <text x="58" y="306" class="time-label">{{ firstTimeLabel }}</text>
      <text
          v-for="tick in xTicks"
          :key="`label-${tick.x}`"
          :x="tick.x"
          y="326"
          text-anchor="middle"
          class="time-label"
      >{{ tick.label }}</text>
      <text :x="chartRight" y="306" text-anchor="end" class="time-label">{{ lastTimeLabel }}</text>
      <text x="58" y="16" class="axis-title">℃</text>
      </svg>
      </div>

      <div class="fixed-right-axis" aria-hidden="true">
        <span class="fixed-axis-title">ms</span>
        <span
            v-for="tick in yTicks"
            :key="`fixed-right-${tick.y}`"
            class="fixed-axis-label"
            :style="{ top: `${tick.y - 8}px` }"
        >
          {{ tick.right }}
        </span>
      </div>

      <div
          v-if="hoveredAlarm"
          class="alarm-tooltip"
          :class="{ critical: hoveredAlarm.level >= 2 }"
          :style="{ left: `${tooltipPosition.x}px`, top: `${tooltipPosition.y}px` }"
      >
        <div class="alarm-tooltip-head">
          <span class="alarm-tooltip-index">{{ hoveredAlarm.index }}</span>
          <strong>{{ hoveredAlarm.typeText }}</strong>
          <span :class="hoveredAlarm.isRecovered ? 'recovered' : 'active'">
            {{ hoveredAlarm.isRecovered ? '已恢复' : '未恢复' }}
          </span>
        </div>
        <time>{{ hoveredAlarm.timeText }}</time>
        <p>{{ hoveredAlarm.message }}</p>
      </div>
    </div>

    <div class="summary-row">
      <span>温度 {{ tempSummary }}</span>
      <span>耗时 {{ decodeSummary }}</span>
      <span>车速 {{ speedSummary }}</span>
    </div>

    <div v-if="alarmMarkers.length > 0" class="alarm-panel">
      <div class="alarm-panel-head">
        <strong>告警记录</strong>
        <span>共 {{ alarmMarkers.length }} 条</span>
      </div>
      <div class="alarm-list">
        <article
            v-for="marker in alarmMarkers"
            :key="`detail-${marker.id}`"
            class="alarm-card"
            :class="{ critical: marker.level >= 2 }"
        >
          <span class="alarm-card-index">{{ marker.index }}</span>
          <div class="alarm-card-content">
            <div class="alarm-card-meta">
              <strong>{{ marker.typeText }}</strong>
              <time>{{ marker.timeText }}</time>
              <span :class="marker.isRecovered ? 'recovered' : 'active'">
                {{ marker.isRecovered ? '已恢复' : '未恢复' }}
              </span>
            </div>
            <p>{{ marker.message }}</p>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ReaderSnapshot } from '@/types/reader'
import type { Alarm } from '@/types/alarm'
import type { ProductionSnapshot } from '@/types/production'

const props = defineProps<{
  readerId: string
  points: ReaderSnapshot[]
  alarms: Alarm[]
  productionPoints: ProductionSnapshot[]
  rangeStart: Date
  rangeEnd: Date
}>()

type AlarmMarker = {
  id: string
  x: number
  level: number
  typeText: string
  timeText: string
  message: string
  isRecovered: boolean
  tooltip: string
  index: number
}

type TrendPoint = {
  index: number
  value: number
  x: number
  y: number
}

type SpeedSegment = {
  key: string
  x1: number
  x2: number
  level: 'stop' | 'slow' | 'normal'
  title: string
}

const chartStage = ref<HTMLElement | null>(null)
const hoveredAlarm = ref<AlarmMarker | null>(null)
const tooltipPosition = ref({ x: 0, y: 0 })

const showAlarmTooltip = (event: MouseEvent, marker: AlarmMarker) => {
  const stage = chartStage.value
  if (!stage) return

  const rect = stage.getBoundingClientRect()
  const tooltipWidth = 300
  const tooltipHeight = 138
  const gap = 14
  const pointerX = event.clientX - rect.left
  const pointerY = event.clientY - rect.top

  hoveredAlarm.value = marker
  tooltipPosition.value = {
    x: Math.min(rect.width - tooltipWidth - 8, Math.max(8, pointerX + gap)),
    y: Math.min(rect.height - tooltipHeight - 8, Math.max(8, pointerY + gap))
  }
}

const hideAlarmTooltip = () => {
  hoveredAlarm.value = null
}

const chart = {
  left: 58,
  top: 24,
  bottom: 276,
}

const secondsPerUnit = 5
const pxPerUnit = 8
const rightPadding = 58
const speedBandY = 150

const durationSeconds = computed(() => {
  const durationMs = Math.max(props.rangeEnd.getTime() - props.rangeStart.getTime(), 1000)
  return Math.ceil(durationMs / 1000)
})

const chartRight = computed(() => chart.left + Math.ceil(durationSeconds.value / secondsPerUnit) * pxPerUnit)
const chartWidth = computed(() => chartRight.value + rightPadding)

const orderedPoints = computed(() => {
  return [...props.points].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
})

const orderedProductionPoints = computed(() => {
  return [...props.productionPoints].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
})

const pointCount = computed(() => orderedPoints.value.length)

const temperatures = computed(() => orderedPoints.value
    .map(item => item.currentTemperature)
    .filter((value): value is number => typeof value === 'number'))

const decodeTimes = computed(() => orderedPoints.value
    .map(item => item.lastValidCodeIntervalMs)
    .filter((value): value is number => typeof value === 'number'))

const speeds = computed(() => orderedProductionPoints.value
    .map(item => item.speed)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value)))

const getRange = (values: number[]) => {
  if (values.length === 0) return { min: 0, max: 1 }
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) {
    const offset = Math.max(Math.abs(min) * 0.1, 1)
    return { min: min - offset, max: max + offset }
  }
  const padding = (max - min) * 0.12
  return { min: min - padding, max: max + padding }
}

const getVisibleRange = (values: number[]) => {
  if (values.length < 20) return getRange(values)

  const sorted = [...values].sort((a, b) => a - b)
  const actualMin = sorted[0]
  const actualMax = sorted[sorted.length - 1]
  const lowIndex = Math.floor((sorted.length - 1) * 0.02)
  const highIndex = Math.ceil((sorted.length - 1) * 0.98)
  const visibleMin = sorted[lowIndex]
  const visibleMax = sorted[highIndex]

  if (visibleMin === visibleMax) return getRange(values)

  const padding = Math.max((visibleMax - visibleMin) * 0.18, 1)
  return {
    min: Math.max(actualMin, visibleMin - padding),
    max: Math.min(actualMax, visibleMax + padding)
  }
}

const tempRange = computed(() => getVisibleRange(temperatures.value))
const decodeRange = computed(() => getVisibleRange(decodeTimes.value))

const scaleTimeX = (time: string) => {
  const start = props.rangeStart.getTime()
  const timestamp = new Date(time).getTime()
  const elapsedSeconds = Math.min(durationSeconds.value, Math.max(0, (timestamp - start) / 1000))
  return chart.left + (elapsedSeconds / secondsPerUnit) * pxPerUnit
}

const alarmTypeMap: Record<number, string> = {
  1: '读码超时',
  2: '读码失败',
  3: '多码',
  4: '发码间隔异常',
  5: '温度过高',
  6: 'TCP断开',
  7: '网络不可达',
  8: '运行时长提醒',
  9: '心跳超时',
  10: 'TCP端口不可用',
  11: 'TCP消息过长'
}

const alarmMarkers = computed(() => {
  const firstTime = props.rangeStart.getTime()
  const lastTime = props.rangeEnd.getTime()

  return props.alarms
      .slice()
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .map((alarm) => {
        const alarmTime = new Date(alarm.startTime).getTime()
        if (!Number.isFinite(alarmTime) || alarmTime < firstTime || alarmTime > lastTime) {
          return null
        }

        const x = chart.left + (((alarmTime - firstTime) / 1000) / secondsPerUnit) * pxPerUnit
        const typeText = alarmTypeMap[alarm.type] || `鍛婅绫诲瀷 ${alarm.type}`
        const timeText = new Date(alarm.startTime).toLocaleString('zh-CN', { hour12: false })

        return {
          id: alarm.id,
          x,
          level: alarm.level,
          typeText,
          timeText,
          message: alarm.message,
          isRecovered: alarm.isRecovered,
          tooltip: `${typeText}\n${timeText}\n${alarm.message}`
        }
      })
      .filter((marker): marker is {
        id: string
        x: number
        level: number
        typeText: string
        timeText: string
        message: string
        isRecovered: boolean
        tooltip: string
      } => marker !== null)
      .map((marker, index) => ({
        ...marker,
        index: index + 1
      }))
})

const scaleY = (value: number, range: { min: number; max: number }) => {
  const clampedValue = Math.min(range.max, Math.max(range.min, value))
  return chart.bottom - ((clampedValue - range.min) / (range.max - range.min)) * (chart.bottom - chart.top)
}

const plottedTemperature = computed(() => orderedPoints.value
    .map((item, index) => ({
      index,
      value: item.currentTemperature,
      x: scaleTimeX(item.time),
      y: typeof item.currentTemperature === 'number' ? scaleY(item.currentTemperature, tempRange.value) : null,
    }))
    .filter((item): item is { index: number; value: number; x: number; y: number } => item.y !== null))

const plottedDecode = computed(() => orderedPoints.value
    .map((item, index) => ({
      index,
      value: item.lastValidCodeIntervalMs,
      x: scaleTimeX(item.time),
      y: typeof item.lastValidCodeIntervalMs === 'number' ? scaleY(item.lastValidCodeIntervalMs, decodeRange.value) : null,
    }))
    .filter((item): item is TrendPoint => item.y !== null))

const getSpeedLevel = (speed: number): SpeedSegment['level'] => {
  if (speed <= 0) return 'stop'
  if (speed < 500) return 'slow'
  return 'normal'
}

const getSpeedLevelText = (speed: number) => {
  if (speed <= 0) return '停车'
  if (speed < 500) return '慢车'
  return '正常'
}

const speedSegments = computed<SpeedSegment[]>(() => {
  const points = orderedProductionPoints.value
      .filter(point => typeof point.speed === 'number' && Number.isFinite(point.speed))

  return points.map((point, index) => {
    const next = points[index + 1]
    const startX = scaleTimeX(point.time)
    const endX = next ? scaleTimeX(next.time) : chartRight.value
    const x2 = Math.max(startX + 1, endX)

    return {
      key: `${point.id}-${index}`,
      x1: startX,
      x2,
      level: getSpeedLevel(point.speed),
      title: `${new Date(point.time).toLocaleString('zh-CN', { hour12: false })} 车速 ${point.speed}，${getSpeedLevelText(point.speed)}`
    }
  })
})

const temperaturePath = computed(() => plottedTemperature.value.map(point => `${point.x},${point.y}`).join(' '))
const decodePath = computed(() => plottedDecode.value.map(point => `${point.x},${point.y}`).join(' '))

const xTicks = computed(() => {
  const stepSeconds =
      durationSeconds.value <= 120 ? 5 :
      durationSeconds.value <= 600 ? 10 :
      60

  return Array.from({ length: Math.floor(durationSeconds.value / stepSeconds) + 1 }, (_, index) => {
    const seconds = index * stepSeconds
    const time = new Date(props.rangeStart.getTime() + seconds * 1000)
    return {
      x: chart.left + (seconds / secondsPerUnit) * pxPerUnit,
      label: time.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: stepSeconds <= 10 ? '2-digit' : undefined,
        hour12: false
      })
    }
  })
})

const yTicks = computed(() => {
  return Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4
    const y = chart.top + ratio * (chart.bottom - chart.top)
    const tempValue = tempRange.value.max - ratio * (tempRange.value.max - tempRange.value.min)
    const decodeValue = decodeRange.value.max - ratio * (decodeRange.value.max - decodeRange.value.min)
    return {
      y,
      temp: tempValue.toFixed(1),
      right: decodeValue.toFixed(0),
    }
  })
})

const formatTimeLabel = (value?: string) => {
  if (!value) return ''
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

const firstTimeLabel = computed(() => formatTimeLabel(props.rangeStart.toISOString()))
const lastTimeLabel = computed(() => formatTimeLabel(props.rangeEnd.toISOString()))

const summarize = (values: number[], digits: number, unit: string) => {
  if (values.length === 0) return '--'
  const min = Math.min(...values)
  const max = Math.max(...values)
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length
  return `${avg.toFixed(digits)}${unit} / ${min.toFixed(digits)}-${max.toFixed(digits)}${unit}`
}

const tempSummary = computed(() => summarize(temperatures.value, 1, '℃'))
const decodeSummary = computed(() => summarize(decodeTimes.value, 0, 'ms'))
const speedSummary = computed(() => summarize(speeds.value, 0, ''))
</script>

<style scoped>
.trend-chart {
  min-width: 0;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 16px;
  box-shadow: var(--shadow-sm);
}

.chart-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.chart-head h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 20px;
  line-height: 1.2;
}

.chart-head p {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 13px;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
  color: var(--text-secondary);
  font-size: 13px;
}

.legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.legend i {
  width: 18px;
  height: 3px;
  border-radius: 999px;
}

.legend .temp {
  background: #dc3545;
}

.legend .decode {
  background: #2f6fed;
}

.legend .speed {
  background: #16a34a;
}

.legend .speed-stop {
  background: #94a3b8;
}

.legend .speed-slow {
  background: #e6a017;
}

.legend .speed-normal {
  background: #16a34a;
}

.legend .alarm {
  height: 10px;
  width: 10px;
  background: #e6a017;
  clip-path: polygon(50% 0, 0 100%, 100% 100%);
}

.chart-svg {
  min-width: 100%;
  height: auto;
  display: block;
  overflow: visible;
  flex: 0 0 auto;
}

.chart-scroll {
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 6px;
  scrollbar-color: var(--border-medium) transparent;
}

.chart-scroll::-webkit-scrollbar {
  height: 8px;
}

.chart-scroll::-webkit-scrollbar-thumb {
  background: var(--border-medium);
  border-radius: 999px;
}

.grid-line {
  stroke: var(--border-light);
  stroke-width: 1;
}

.x-grid {
  opacity: 0.45;
}

.axis-line {
  stroke: var(--border-medium);
  stroke-width: 1;
}

.axis-line.soft {
  stroke: var(--border-light);
}

.axis-label,
.time-label,
.axis-title {
  fill: var(--text-muted);
  font-size: 12px;
  font-family: 'SF Mono', 'JetBrains Mono', monospace;
}

.axis-title {
  font-weight: 700;
}

.right-axis-label {
  display: none;
}

.temp-line,
.decode-line {
  fill: none;
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}

.temp-line {
  stroke: #dc3545;
}

.decode-line {
  stroke: #2f6fed;
}

.speed-band-label {
  fill: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
}

.speed-track {
  stroke: var(--border-light);
  stroke-width: 10;
  stroke-linecap: round;
  opacity: 0.65;
}

.speed-segment {
  stroke-width: 10;
  stroke-linecap: butt;
  opacity: 0.68;
}

.speed-segment.stop {
  stroke: #94a3b8;
}

.speed-segment.slow {
  stroke: #e6a017;
}

.speed-segment.normal {
  stroke: #16a34a;
}

.alarm-hit-area {
  fill: transparent;
  cursor: help;
}

.alarm-guide {
  stroke: #e6a017;
  stroke-width: 1.5;
  stroke-dasharray: 5 5;
  opacity: 0;
  pointer-events: none;
  vector-effect: non-scaling-stroke;
  transition: opacity 0.15s ease;
}

.alarm-guide.critical {
  stroke: #dc3545;
}

.alarm-symbol {
  fill: #e6a017;
  stroke: var(--bg-card);
  stroke-width: 1.8;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.28));
  cursor: help;
  transition: transform 0.15s ease, filter 0.15s ease;
  transform-box: fill-box;
  transform-origin: center;
}

.alarm-symbol.critical {
  fill: #dc3545;
}

.alarm-marker:hover .alarm-guide {
  opacity: 0.9;
}

.alarm-marker:hover .alarm-symbol {
  transform: scale(1.25);
  filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.35));
}

.chart-stage {
  position: relative;
}

.fixed-right-axis {
  position: absolute;
  top: 0;
  right: 0;
  width: 54px;
  height: 276px;
  pointer-events: none;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0), var(--bg-card) 34%);
}

.fixed-axis-title {
  position: absolute;
  top: 8px;
  right: 0;
  color: var(--text-muted);
  font-family: 'SF Mono', 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 700;
}

.fixed-axis-label {
  position: absolute;
  right: 0;
  color: var(--text-muted);
  font-family: 'SF Mono', 'JetBrains Mono', monospace;
  font-size: 12px;
  line-height: 16px;
}

.alarm-tooltip {
  position: absolute;
  z-index: 10;
  width: 300px;
  padding: 12px 14px;
  border: 1px solid rgba(230, 160, 23, 0.35);
  border-left: 4px solid #e6a017;
  border-radius: 9px;
  background: var(--bg-card);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.2);
  color: var(--text-primary);
  pointer-events: none;
}

.alarm-tooltip.critical {
  border-color: rgba(220, 53, 69, 0.35);
  border-left-color: #dc3545;
}

.alarm-tooltip-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 7px;
}

.alarm-tooltip-head strong {
  flex: 1;
  font-size: 13px;
}

.alarm-tooltip-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #e6a017;
  color: #fff;
  font-size: 11px;
  font-weight: 900;
}

.alarm-tooltip.critical .alarm-tooltip-index {
  background: #dc3545;
}

.alarm-tooltip-head .recovered {
  color: var(--success);
  font-size: 12px;
}

.alarm-tooltip-head .active {
  color: var(--danger);
  font-size: 12px;
  font-weight: 700;
}

.alarm-tooltip time {
  display: block;
  margin-bottom: 6px;
  color: var(--text-muted);
  font-family: 'SF Mono', 'JetBrains Mono', monospace;
  font-size: 11px;
}

.alarm-tooltip p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.55;
  word-break: break-word;
}

.summary-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 10px;
  color: var(--text-secondary);
  font-size: 13px;
}

.alarm-panel {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--border-light);
}

.alarm-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  color: var(--text-primary);
  font-size: 14px;
}

.alarm-panel-head span {
  color: var(--text-muted);
  font-size: 12px;
}

.alarm-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  max-height: 210px;
  overflow-y: auto;
  padding-right: 4px;
}

.alarm-list::-webkit-scrollbar {
  width: 5px;
}

.alarm-list::-webkit-scrollbar-thumb {
  background: var(--border-medium);
  border-radius: 999px;
}

.alarm-card {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 9px 10px;
  border: 1px solid rgba(230, 160, 23, 0.24);
  border-left: 3px solid #e6a017;
  border-radius: 8px;
  background: rgba(230, 160, 23, 0.06);
}

.alarm-card.critical {
  border-color: rgba(220, 53, 69, 0.25);
  border-left-color: #dc3545;
  background: rgba(220, 53, 69, 0.06);
}

.alarm-card-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 23px;
  height: 23px;
  border-radius: 50%;
  color: #fff;
  background: #e6a017;
  font-size: 11px;
  font-weight: 800;
}

.alarm-card.critical .alarm-card-index {
  background: #dc3545;
}

.alarm-card-content {
  flex: 1;
  min-width: 0;
}

.alarm-card-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  margin-bottom: 4px;
  font-size: 12px;
}

.alarm-card-meta strong {
  color: var(--text-primary);
  font-size: 13px;
}

.alarm-card-meta time {
  color: var(--text-muted);
  font-family: 'SF Mono', 'JetBrains Mono', monospace;
}

.alarm-card-meta .recovered {
  color: var(--success);
}

.alarm-card-meta .active {
  color: var(--danger);
  font-weight: 700;
}

.alarm-card-content p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.45;
  word-break: break-word;
}

.empty-state {
  min-height: 230px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  border: 1px dashed var(--border-medium);
  border-radius: 8px;
  background: var(--bg-primary);
}
</style>

