<template>
  <div class="detector-grid">
    <div class="grid-header">
      <div class="title-area">
        <span class="title-mark"></span>
        <h3>设备状态</h3>
      </div>
      <div class="legend-area">
        <span class="legend-item"><span class="dot unknown"></span>未知</span>
        <span class="legend-item"><span class="dot offline"></span>离线</span>
        <span class="legend-item"><span class="dot connecting"></span>连接中</span>
        <span class="legend-item"><span class="dot online"></span>在线</span>
        <span class="legend-item"><span class="dot warning"></span>警告</span>
        <span class="legend-item"><span class="dot fault"></span>故障</span>
        <span class="legend-item"><span class="dot maintenance"></span>维护</span>
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
            <div class="device-name">{{ detector.id }}</div>
            <div class="device-id">{{ detector.ip }}</div>
          </div>
          <div class="header-actions">
            <button
                class="decode-btn"
                @click.stop="openDecodeRecords(detector)"
                title="最近解码记录"
            >
              📋
            </button>
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

        <!-- 数值区域 - 显示温度 -->
        <div class="value-area" @click="$emit('openDetail', detector)">
          <span class="value-number" :class="getTempClass(detector)">{{ (detector.temperature || 0).toFixed(1) }}</span>
          <span class="value-unit">°C</span>
          <span class="value-trend" :class="detector.trend > 0 ? 'trend-up' : 'trend-down'">
    {{ detector.trend > 0 ? '↑' : '↓' }} {{ Math.abs(detector.trend).toFixed(1) }}
  </span>
        </div>

        <!-- 趋势图 -->
        <div class="chart-area" @click="$emit('openDetail', detector)">
          <canvas :ref="setCanvasRef(detector.id)" class="trend-canvas"></canvas>
        </div>

        <!-- 底部统计 -->
        <div class="footer-stats" @click="$emit('openDetail', detector)">
          <div class="stat">
            <span class="stat-label">平均间隔</span>
            <strong class="stat-value">{{ formatMs(detector.recentAverageValidCodeIntervalMs) }}</strong>
          </div>
          <div class="stat">
            <span class="stat-label">最新间隔</span>
            <strong class="stat-value">{{ formatMs(detector.lastValidCodeIntervalMs) }}</strong>
          </div>
          <div class="stat">
            <span class="stat-label">温度阈值</span>
            <strong class="stat-value">{{ getDetectorTempThreshold(detector).danger.toFixed(1) }}°C</strong>
          </div>
        </div>

        <!-- 运行时长区域 -->
        <div class="runtime-area" @click="$emit('openDetail', detector)">
          <span class="runtime-icon">⏱️</span>
          <span class="runtime-label">累计运行</span>
          <strong class="runtime-value" :class="getRuntimeClass(detector)">
            {{ getRuntimeHours(detector) }} 小时
          </strong>
        </div>

        <!-- 重启按钮 - 仅在需要重启提醒时显示 -->
        <div v-if="needsRestart(detector.id)" class="restart-area">
          <button class="restart-btn" @click.stop="openRestartConfirm(detector)">
            🔄 重启读码器
          </button>
          <div class="restart-hint">运行时间已达阈值，建议重启</div>
        </div>

        <div class="update-time" @click="$emit('openDetail', detector)">{{ detector.lastUpdateTime || '--:--:--' }}</div>
      </div>
    </div>

    <!-- 解码记录 Modal -->
    <DecodeRecordsModal
        :visible="decodeModalVisible"
        :detector="selectedDetector"
        @close="closeDecodeRecords"
    />

    <!-- 重启确认 Modal -->
    <div v-if="restartModalVisible" class="modal-overlay" @click="closeRestartConfirm">
      <div class="restart-modal" @click.stop>
        <div class="restart-modal-header">
          <span class="modal-icon">🔄</span>
          <span>确认重启读码器</span>
          <button class="modal-close" @click="closeRestartConfirm">×</button>
        </div>
        <div class="restart-modal-body">
          <div class="restart-info">
            <div class="info-row">
              <span class="info-label">读码器ID</span>
              <span class="info-value">{{ restartTarget?.id }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">读码器名称</span>
              <span class="info-value">{{ restartTarget?.name }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">累计运行</span>
              <span class="info-value warning">{{ getRuntimeHours(restartTarget) }} 小时</span>
            </div>
            <div class="info-row">
              <span class="info-label">阈值</span>
              <span class="info-value">{{ getThresholdHours(restartTarget) }} 小时</span>
            </div>
          </div>
          <div class="restart-form">
            <div class="form-group">
              <label>确认人</label>
              <input v-model="confirmForm.confirmedBy" type="text" placeholder="请输入确认人姓名" class="form-input" />
            </div>
            <div class="form-group">
              <label>备注</label>
              <textarea v-model="confirmForm.remark" placeholder="请输入备注信息（可选）" class="form-textarea" rows="3"></textarea>
            </div>
          </div>
        </div>
        <div class="restart-modal-footer">
          <button class="cancel-btn" @click="closeRestartConfirm">取消</button>
          <button class="confirm-btn" @click="confirmRestart" :disabled="restartLoading">
            {{ restartLoading ? '处理中...' : '确认重启' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, reactive, nextTick } from 'vue'
import DecodeRecordsModal from './DecodeRecordsModal.vue'
import { runtimeApi } from '@/api/runtime'
import type { ReaderRuntime } from '@/types/runtime'

const props = defineProps<{
  detectors: any[]
  threshold: { warning: number; danger: number }
}>()

// 解码记录 Modal 状态
const decodeModalVisible = ref(false)
const selectedDetector = ref<any>(null)

// 重启确认 Modal 状态
const restartModalVisible = ref(false)
const restartTarget = ref<any>(null)
const restartLoading = ref(false)
const DEFAULT_CONFIRMED_BY = '操作员'
const DEFAULT_RESTART_REMARK = '统一重启后确认'
const confirmForm = reactive({
  confirmedBy: DEFAULT_CONFIRMED_BY,
  remark: DEFAULT_RESTART_REMARK
})

// 需要重启的读码器ID列表
const restartReminderIds = ref<Set<string>>(new Set())

// 存储每个读码器的运行时长信息
const runtimeMap = reactive<Map<string, ReaderRuntime>>(new Map())

const applyRuntimeToDetector = (runtime: ReaderRuntime) => {
  const detector = props.detectors.find(d => d.id === runtime.readerId)
  if (!detector) return

  detector.runtimeHours = runtime.accumulatedHours
  detector.accumulatedSeconds = runtime.accumulatedSeconds
  detector.remainingSeconds = runtime.remainingSeconds
  detector.reminderActive = runtime.reminderActive
  detector.thresholdHours = runtime.thresholdHours
  detector.reminderThresholdSeconds = runtime.reminderThresholdSeconds
  detector.isAccumulating = runtime.isAccumulating
  detector.workshopId = runtime.workshopId
  detector.lineId = runtime.lineId
  detector.lineName = runtime.lineId
  detector.ipcId = runtime.ipcId
  detector.readerName = runtime.readerName
  detector.stationName = runtime.readerName || detector.stationName
  detector.runtimeUpdatedTime = runtime.updatedTime
}

// 打开解码记录弹窗
const openDecodeRecords = (detector: any) => {
  selectedDetector.value = detector
  decodeModalVisible.value = true
}

// 关闭解码记录弹窗
const closeDecodeRecords = () => {
  decodeModalVisible.value = false
  selectedDetector.value = null
}

// 获取需要重启提醒的读码器列表
const fetchRestartReminders = async () => {
  try {
    const response = await runtimeApi.getRestartReminders()
    restartReminderIds.value.clear()
    if (response.readers && response.readers.length > 0) {
      response.readers.forEach(reader => {
        restartReminderIds.value.add(reader.readerId)
        // 同时更新运行时长信息
        runtimeMap.set(reader.readerId, reader)
        applyRuntimeToDetector(reader)
      })
    }
  } catch (error) {
    console.error('获取重启提醒列表失败:', error)
  }
}

// 判断读码器是否需要重启
const needsRestart = (readerId: string) => {
  return restartReminderIds.value.has(readerId)
}

// 获取读码器运行时长
const fetchReaderRuntime = async (readerId: string) => {
  try {
    const runtime = await runtimeApi.getReaderRuntime(readerId)
    runtimeMap.set(readerId, runtime)
    applyRuntimeToDetector(runtime)
  } catch (error) {
    console.error(`获取读码器 ${readerId} 运行时长失败:`, error)
  }
}

// 批量获取所有读码器运行时长
const fetchAllRuntimes = async () => {
  for (const detector of props.detectors) {
    await fetchReaderRuntime(detector.id)
  }
}

const fetchMissingRuntimes = async () => {
  for (const detector of props.detectors) {
    const runtime = runtimeMap.get(detector.id)
    if (runtime) {
      applyRuntimeToDetector(runtime)
    } else {
      await fetchReaderRuntime(detector.id)
    }
  }
}

// 获取运行时长小时数
const getRuntimeHours = (detector: any) => {
  const runtime = runtimeMap.get(detector.id)
  if (runtime) {
    return runtime.accumulatedHours.toFixed(1)
  }
  return detector.runtimeHours?.toFixed(1) || '0.0'
}

// 获取阈值小时数
const getThresholdHours = (detector: any) => {
  const runtime = runtimeMap.get(detector.id)
  if (runtime) {
    return runtime.thresholdHours.toFixed(1)
  }
  return detector.thresholdHours?.toFixed(1) || '8.0'
}

// 获取运行时长样式类
const getRuntimeClass = (detector: any) => {
  const runtime = runtimeMap.get(detector.id)
  const reminderActive = runtime?.reminderActive || detector.reminderActive
  if (reminderActive) {
    return 'warning'
  }
  const hours = runtime?.accumulatedHours || detector.runtimeHours || 0
  const threshold = runtime?.thresholdHours || detector.thresholdHours || 8
  if (hours >= threshold) {
    return 'danger'
  }
  if (hours >= threshold * 0.8) {
    return 'warning'
  }
  return ''
}

// 打开重启确认弹窗
const openRestartConfirm = (detector: any) => {
  restartTarget.value = detector
  confirmForm.confirmedBy = DEFAULT_CONFIRMED_BY
  confirmForm.remark = `${detector.id || '读码器'} ${DEFAULT_RESTART_REMARK}`
  restartModalVisible.value = true
}

// 关闭重启确认弹窗
const closeRestartConfirm = () => {
  restartModalVisible.value = false
  restartTarget.value = null
  restartLoading.value = false
}

// 确认重启
const confirmRestart = async () => {
  if (!restartTarget.value) return

  if (!confirmForm.confirmedBy.trim()) {
    alert('请输入确认人姓名')
    return
  }

  restartLoading.value = true
  try {
    const result = await runtimeApi.confirmRestart(restartTarget.value.id, {
      confirmedBy: confirmForm.confirmedBy,
      remark: confirmForm.remark || '手动重启'
    })

    // 重启成功后，从提醒列表中移除
    restartReminderIds.value.delete(restartTarget.value.id)

    // 更新本地运行时长信息
    if (result.counter) {
      runtimeMap.set(restartTarget.value.id, result.counter)
      applyRuntimeToDetector(result.counter)
    }

    alert(`重启成功！${result.message}`)
    closeRestartConfirm()
  } catch (error: any) {
    console.error('重启失败:', error)
    alert(`重启失败：${error.message || '未知错误'}`)
  } finally {
    restartLoading.value = false
  }
}

const getDetectorTempThreshold = (detector: any) => {
  return detector.customTempThreshold || { warning: 45, danger: 60 }
}

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

    const values = detector.trendData.map((value: number) => Number(value)).filter((value: number) => Number.isFinite(value))
    if (!values.length) return

    const maxTemp = Math.max(...values)
    const minTemp = Math.min(...values)
    const rawRange = maxTemp - minTemp
    const minVisibleRange = 0.2
    const range = Math.max(rawRange, minVisibleRange)
    const center = rawRange > 0 ? (maxTemp + minTemp) / 2 : (detector.temperature || maxTemp)
    const chartMin = center - range / 2
    const chartMax = center + range / 2
    const chartPadding = 4

    const stepX = values.length > 1 ? width / (values.length - 1) : width

    ctx.beginPath()
    ctx.lineWidth = 1.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const threshold = getDetectorTempThreshold(detector)
    if (detector.temperature >= threshold.danger) ctx.strokeStyle = '#dc3545'
    else if (detector.temperature >= threshold.warning) ctx.strokeStyle = '#e6a017'
    else ctx.strokeStyle = '#2d6a4f'

    values.forEach((val: number, i: number) => {
      const x = values.length > 1 ? i * stepX : width / 2
      const ratio = (val - chartMin) / (chartMax - chartMin)
      const y = height - chartPadding - ratio * (height - chartPadding * 2)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    if (values.length === 1) {
      ctx.arc(width / 2, height / 2, 2, 0, Math.PI * 2)
    }
    ctx.stroke()
  })
  animationMap.set(detector.id, id)
}

const drawAllCharts = () => {
  props.detectors.forEach(d => {
    const canvas = canvasMap.get(d.id)
    if (canvas) drawChart(d, canvas)
  })
}

const getCardStatus = (d: any) => {
  return d.status || 'unknown'
}

const getDotClass = (d: any) => {
  return d.status || 'unknown'
}

const getTempClass = (d: any) => {
  const temp = d.temperature || 0
  const tempThreshold = getDetectorTempThreshold(d)
  if (temp >= tempThreshold.danger) return 'danger'
  if (temp >= tempThreshold.warning) return 'warning'
  return 'normal'
}

const formatMs = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--'
  return `${Number(value).toFixed(0)}ms`
}

let runtimeRefreshInterval: any

const refreshRuntimeState = async () => {
  await fetchRestartReminders()
  await fetchAllRuntimes()
}

const startRuntimeRefresh = () => {
  runtimeRefreshInterval = setInterval(refreshRuntimeState, 60000)
}

// 监听 detectors 变化，只为新出现的读码器补运行时长，避免随列表 3 秒刷新高频请求 runtime 接口
watch(() => props.detectors, (newDetectors) => {
  if (newDetectors && newDetectors.length > 0) {
    fetchMissingRuntimes()
    nextTick(drawAllCharts)
  }
}, { deep: true, immediate: true })

onMounted(() => {
  // 获取需要重启提醒的读码器列表
  refreshRuntimeState()
  startRuntimeRefresh()

  setTimeout(drawAllCharts, 100)
})

onUnmounted(() => {
  if (runtimeRefreshInterval) clearInterval(runtimeRefreshInterval)
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

.decode-btn {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  transition: all 0.2s ease;
  opacity: 0.6;
}

.decode-btn:hover {
  opacity: 1;
  background: var(--bg-tertiary);
  transform: scale(1.05);
}

.config-btn {
  background: none;
  border: none;
  font-size: 18px;
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
  background: var(--primary);
  border-radius: 2px;
}

.title-area h3 {
  font-size: 18px;
  font-weight: 500;
  margin: 0;
  color: var(--text-muted);
}

.legend-area {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 17px;
  color: var(--text-muted);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot.unknown { background: var(--text-muted); }
.dot.offline { background: var(--border-heavy); }
.dot.connecting { background: var(--info); }
.dot.online { background: var(--success); }
.dot.warning { background: var(--warning); }
.dot.fault { background: var(--danger); }
.dot.maintenance { background: var(--primary); }

.grid-container {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
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
.device-card[data-status="unknown"] { border-top: 3px solid var(--text-muted); opacity: 0.85; }
.device-card[data-status="offline"] { border-top: 3px solid var(--border-heavy); opacity: 0.7; }
.device-card[data-status="connecting"] { border-top: 3px solid var(--info); }
.device-card[data-status="online"] { border-top: 3px solid var(--success); }
.device-card[data-status="warning"] { border-top: 3px solid var(--warning); }
.device-card[data-status="fault"] { border-top: 3px solid var(--danger); }
.device-card[data-status="maintenance"] { border-top: 3px solid var(--primary); }

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

.status-dot.unknown { background: var(--text-muted); }
.status-dot.offline { background: var(--border-heavy); }
.status-dot.connecting { background: var(--info); animation: pulse-warning 1.5s infinite; }
.status-dot.online { background: var(--success); }
.status-dot.warning { background: var(--warning); animation: pulse-warning 1.5s infinite; }
.status-dot.fault { background: var(--danger); animation: pulse-danger 1s infinite; }
.status-dot.maintenance { background: var(--primary); }

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
  font-size: 18px;
  color: var(--text-muted);
  margin-left: 4px;
}

.value-trend {
  font-size: 17px;
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
  font-size: 19px;
}

.temp-area.normal { color: var(--success); }
.temp-area.warning { color: var(--warning); background: rgba(230, 160, 23, 0.1); }
.temp-area.danger { color: var(--danger); background: rgba(220, 53, 69, 0.1); }

.temp-value {
  font-size: 24px;
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
  padding: 10px 0;
  border-top: 1px solid var(--border-light);
  margin-bottom: 8px;
}

/* 运行时长区域 */
.runtime-area {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  margin: 8px 0;
  border-radius: 20px;
  background: var(--bg-tertiary);
  font-size: 15px;
}

.runtime-icon {
  font-size: 16px;
}

.runtime-label {
  color: var(--text-muted);
}

.runtime-value {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary);
}

.runtime-value.warning {
  color: var(--warning);
}

.runtime-value.danger {
  color: var(--danger);
}

/* 重启按钮区域 */
.restart-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin: 8px 0;
  padding: 8px;
  border-radius: 10px;
  background: rgba(220, 53, 69, 0.08);
  border: 1px solid rgba(220, 53, 69, 0.3);
}

.restart-btn {
  background: var(--danger);
  border: none;
  padding: 8px 16px;
  border-radius: 24px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  color: white;
  transition: var(--transition);
}

.restart-btn:hover {
  background: #c82333;
  transform: scale(1.02);
}

.restart-hint {
  font-size: 13px;
  color: var(--danger);
}

.stat {
  text-align: center;
  flex: 1;
}

.stat-label {
  display: block;
  font-size: 15px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.stat-value.station {
  font-size: 16px;
  word-break: break-all;
}

.update-time {
  font-size: 14px;
  color: var(--text-muted);
  text-align: right;
}

/* 重启确认 Modal 样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1100;
}

.restart-modal {
  background: var(--bg-card);
  border-radius: 16px;
  width: 90%;
  max-width: 450px;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.restart-modal-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  background: var(--danger);
  color: white;
  font-size: 18px;
  font-weight: 600;
}

.modal-icon {
  font-size: 22px;
}

.modal-close {
  margin-left: auto;
  background: none;
  border: none;
  font-size: 28px;
  cursor: pointer;
  color: white;
  padding: 0;
  line-height: 1;
  opacity: 0.8;
}

.modal-close:hover {
  opacity: 1;
}

.restart-modal-body {
  padding: 20px;
}

.restart-info {
  background: var(--bg-primary);
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 20px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-light);
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 13px;
  color: var(--text-muted);
}

.info-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.info-value.warning {
  color: var(--warning);
}

.restart-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.form-input, .form-textarea {
  padding: 10px 12px;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  transition: var(--transition);
}

.form-input:focus, .form-textarea:focus {
  border-color: var(--info);
}

.form-textarea {
  resize: vertical;
}

.restart-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-light);
}

.cancel-btn, .confirm-btn {
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: var(--transition);
}

.cancel-btn {
  background: none;
  border: 1px solid var(--border-medium);
  color: var(--text-secondary);
}

.cancel-btn:hover {
  background: var(--bg-primary);
  border-color: var(--text-muted);
}

.confirm-btn {
  background: var(--danger);
  border: none;
  color: white;
}

.confirm-btn:hover {
  background: #c82333;
}

.confirm-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
  .restart-modal {
    width: 95%;
  }
}
</style>
