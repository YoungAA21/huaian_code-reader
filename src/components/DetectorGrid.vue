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
        <span class="card-scan"></span>
        <!-- 澶撮儴 -->
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
              记录
            </button>
            <button
                class="config-btn"
                @click.stop="$emit('config-threshold', detector)"
                title="配置阈值"
            >
              设置
            </button>
            <div class="status-dot" :class="getDotClass(detector)"></div>
          </div>
        </div>

        <div class="card-main" @click="$emit('openDetail', detector)">
          <div class="primary-metric temperature-metric">
            <span class="metric-label">温度</span>
            <strong :class="getTempClass(detector)">{{ (detector.temperature || 0).toFixed(1) }}<small>°C</small></strong>
            <span class="metric-sub" :class="detector.trend > 0 ? 'trend-up' : 'trend-down'">
              {{ detector.trend > 0 ? '↑' : '↓' }}{{ Math.abs(detector.trend).toFixed(1) }}
            </span>
          </div>
          <div class="primary-metric success-metric" :class="getTriggerCycleClass(detector)">
            <span class="metric-label">有效成功率</span>
            <strong>{{ formatPercent(getTriggerPrimaryRate(detector)) }}</strong>
            <span class="metric-sub">{{ formatTriggerHealth(detector) }}</span>
          </div>
        </div>

        <div class="chart-area" @click="$emit('openDetail', detector)">
          <canvas :ref="setCanvasRef(detector.id)" class="trend-canvas"></canvas>
        </div>

        <div class="metric-grid" @click="$emit('openDetail', detector)">
          <div class="metric-cell">
            <span>严格成功率</span>
            <strong>{{ formatPercent(detector.triggerSuccessRate) }}</strong>
          </div>
          <div class="metric-cell">
            <span>补码数</span>
            <strong>{{ formatCount(detector.triggerLateRecoveredCount) }}</strong>
          </div>
          <div class="metric-cell">
            <span>触发周期</span>
            <strong>{{ formatMs(detector.triggerLastIntervalMs) }}</strong>
          </div>
          <div class="metric-cell">
            <span>温度阈值</span>
            <strong>{{ getDetectorTempThreshold(detector).danger.toFixed(1) }}°C</strong>
          </div>
        </div>

        <div class="card-foot">
          <div class="runtime-strip" :class="getRuntimeClass(detector)" @click="$emit('openDetail', detector)">
            <span>累计运行</span>
            <strong>{{ getRuntimeHours(detector) }}h</strong>
          </div>
          <div
              class="replacement-panel"
              :class="getReplacementStatus(detector.id)?.hasReplacementRecord ? 'replaced' : 'pending'"
          >
            <div class="replacement-copy">
              <span class="replacement-label">备件</span>
              <strong>
                {{
                  getReplacementStatus(detector.id)
                      ? (getReplacementStatus(detector.id)?.hasReplacementRecord ? '已更换' : '待更换')
                      : (replacementStatusLoading ? '加载中' : '未知')
                }}
              </strong>
            </div>
            <button
                class="replacement-btn"
                @click.stop="confirmReplacement(detector)"
                :disabled="replacementSubmittingId === detector.id"
            >
              {{ replacementSubmittingId === detector.id ? '...' : '更换' }}
            </button>
          </div>
          <div class="update-time" @click="$emit('openDetail', detector)">{{ detector.lastUpdateTime || '--:--:--' }}</div>
        </div>

        <!-- 重启按钮 - 仅在需要重启提醒时显示 -->
        <div v-if="needsRestart(detector.id)" class="restart-area">
          <button class="restart-btn" @click.stop="openRestartConfirm(detector)">
            重启读码器
          </button>
          <div class="restart-hint">运行时间已达阈值，建议重启</div>
        </div>

      </div>
    </div>

    <!-- 瑙ｇ爜璁板綍 Modal -->
    <DecodeRecordsModal
        :visible="decodeModalVisible"
        :detector="selectedDetector"
        @close="closeDecodeRecords"
    />

    <!-- 閲嶅惎纭 Modal -->
    <div v-if="restartModalVisible" class="modal-overlay" @click="closeRestartConfirm">
      <div class="restart-modal" @click.stop>
        <div class="restart-modal-header">
          <span class="modal-icon">!</span>
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
import { sparePartLocationApi, sparePartReplacementApi } from '@/api/sparePartReplacement'
import { useAppDialog } from '@/utils/appDialog'
import type { ReaderRuntime } from '@/types/runtime'
import type { SparePartUsageStatus } from '@/types/sparePartReplacement'

const props = defineProps<{
  detectors: any[]
  threshold: { warning: number; danger: number }
  readerRuntimes: ReaderRuntime[]
}>()

// 瑙ｇ爜璁板綍 Modal 鐘舵€?
const decodeModalVisible = ref(false)
const selectedDetector = ref<any>(null)

// 閲嶅惎纭 Modal 鐘舵€?
const restartModalVisible = ref(false)
const restartTarget = ref<any>(null)
const restartLoading = ref(false)
const appDialog = useAppDialog()
const DEFAULT_CONFIRMED_BY = '操作员'
const DEFAULT_RESTART_REMARK = '统一重启后确认'
const confirmForm = reactive({
  confirmedBy: DEFAULT_CONFIRMED_BY,
  remark: DEFAULT_RESTART_REMARK
})

// 闇€瑕侀噸鍚殑璇荤爜鍣↖D鍒楄〃
const restartReminderIds = ref<Set<string>>(new Set())

// 瀛樺偍姣忎釜璇荤爜鍣ㄧ殑杩愯鏃堕暱淇℃伅
const runtimeMap = reactive<Map<string, ReaderRuntime>>(new Map())
const replacementStatusMap = reactive<Map<string, SparePartUsageStatus>>(new Map())
const replacementLocationIds = ref<Set<string>>(new Set())
const replacementSubmittingId = ref<string | null>(null)
const replacementStatusLoading = ref(false)
let replacementRefreshInterval: ReturnType<typeof setInterval> | null = null

const fetchReplacementStatus = async () => {
  if (replacementStatusLoading.value) return

  replacementStatusLoading.value = true
  try {
    const [statusResponse, locationResponse] = await Promise.all([
      sparePartReplacementApi.getAllStatus(),
      sparePartLocationApi.getAll(true)
    ])
    const locationIds = new Set((locationResponse.items || []).map(location => location.locationId))
    replacementLocationIds.value = locationIds

    const currentIds = new Set<string>()
    statusResponse.items.forEach((status) => {
      if (!locationIds.has(status.locationId)) return
      currentIds.add(status.locationId)
      replacementStatusMap.set(status.locationId, status)
    })
    for (const locationId of replacementStatusMap.keys()) {
      if (!currentIds.has(locationId)) replacementStatusMap.delete(locationId)
    }
  } catch (error) {
    console.error('鑾峰彇璇荤爜鍣ㄥ浠剁姸鎬佸け璐?', error)
  } finally {
    replacementStatusLoading.value = false
  }
}

const getReaderLocationId = (readerId: string) => {
  const normalizedReaderId = readerId.trim().toUpperCase()
  const canonicalId = `READER-${normalizedReaderId}`

  if (replacementStatusMap.has(canonicalId)) return canonicalId
  if (replacementStatusMap.has(normalizedReaderId)) return normalizedReaderId

  const matchedLocation = Array.from(replacementStatusMap.values()).find(status => {
    const searchableText = `${status.locationName} ${status.sparePartName || ''}`.toUpperCase()
    return status.expectedSparePartType?.toUpperCase() === 'READER' &&
        searchableText.includes(normalizedReaderId)
  })

  return matchedLocation?.locationId || canonicalId
}

const getReplacementStatus = (readerId: string) => {
  return replacementStatusMap.get(getReaderLocationId(readerId))
}

const formatPercent = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--'
  return `${Number(value).toFixed(1)}%`
}

const formatCount = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--'
  return Number(value).toLocaleString('zh-CN')
}

const formatTriggerHealth = (detector: any) => {
  const status = String(detector.triggerCycleHealthStatus || '')
  if (!status) return '触发监测待采集'
  if (status === 'Healthy') return '触发链路正常'
  if (status === 'Warning') return '触发链路预警'
  if (status === 'Critical') return '触发链路异常'
  return status
}

const getTriggerPrimaryRate = (detector: any) => {
  return detector.triggerEffectiveSuccessRate ?? detector.triggerSuccessRate
}

const getTriggerCycleClass = (detector: any) => {
  const status = String(detector.triggerCycleHealthStatus || '')
  if (status === 'Critical') return 'critical'
  if (status === 'Warning') return 'warning'
  if (status === 'Healthy') return 'healthy'
  return 'unknown'
}

const formatLocalDateTime = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
      `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

const confirmReplacement = async (detector: any) => {
  if (replacementSubmittingId.value) return

  replacementSubmittingId.value = detector.id
  try {
    const currentStatus = getReplacementStatus(detector.id)
    const locationId = currentStatus?.locationId || getReaderLocationId(detector.id)
    const result = await sparePartReplacementApi.recordReplacement({
      locationId,
      sparePartName: detector.name || detector.id,
      sparePartType: 'Reader',
      replacementTime: formatLocalDateTime(new Date()),
      replacedBy: '操作员',
      remark: '页面一键更换备件'
    })
    replacementLocationIds.value.add(result.status.locationId)
    replacementStatusMap.set(result.status.locationId, result.status)
    await appDialog.alert({
      title: '更换备件',
      message: result.message,
      type: 'success'
    })
  } catch (error: any) {
    console.error('更换备件失败:', error)
    await appDialog.alert({
      title: '更换失败',
      message: `更换备件失败：${error.response?.data?.message || error.message || '未知错误'}`,
      type: 'danger'
    })
  } finally {
    replacementSubmittingId.value = null
  }
}

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

// 鎵撳紑瑙ｇ爜璁板綍寮圭獥
const openDecodeRecords = (detector: any) => {
  selectedDetector.value = detector
  decodeModalVisible.value = true
}

// 鍏抽棴瑙ｇ爜璁板綍寮圭獥
const closeDecodeRecords = () => {
  decodeModalVisible.value = false
  selectedDetector.value = null
}

// 判断读码器是否需要重启
const needsRestart = (readerId: string) => {
  return restartReminderIds.value.has(readerId)
}

// 鑾峰彇杩愯鏃堕暱灏忔椂鏁?
const getRuntimeHours = (detector: any) => {
  const runtime = runtimeMap.get(detector.id)
  if (runtime) {
    return runtime.accumulatedHours.toFixed(1)
  }
  return detector.runtimeHours?.toFixed(1) || '0.0'
}

// 鑾峰彇闃堝€煎皬鏃舵暟
const getThresholdHours = (detector: any) => {
  const runtime = runtimeMap.get(detector.id)
  if (runtime) {
    return runtime.thresholdHours.toFixed(1)
  }
  return detector.thresholdHours?.toFixed(1) || '8.0'
}

const getRuntimeClass = (detector: any) => {
  const runtime = runtimeMap.get(detector.id)
  const reminderActive = runtime?.reminderActive || detector.reminderActive
  if (reminderActive) return 'warning'

  const hours = runtime?.accumulatedHours || detector.runtimeHours || 0
  const threshold = runtime?.thresholdHours || detector.thresholdHours || 8
  if (hours >= threshold) return 'danger'
  if (hours >= threshold * 0.8) return 'warning'
  return ''
}

// 鎵撳紑閲嶅惎纭寮圭獥
const openRestartConfirm = (detector: any) => {
  restartTarget.value = detector
  confirmForm.confirmedBy = DEFAULT_CONFIRMED_BY
  confirmForm.remark = `${detector.id || '读码器'} ${DEFAULT_RESTART_REMARK}`
  restartModalVisible.value = true
}

// 鍏抽棴閲嶅惎纭寮圭獥
const closeRestartConfirm = () => {
  restartModalVisible.value = false
  restartTarget.value = null
  restartLoading.value = false
}

// 纭閲嶅惎
const confirmRestart = async () => {
  if (!restartTarget.value) return

  if (!confirmForm.confirmedBy.trim()) {
    await appDialog.alert({
      title: '信息不完整',
      message: '请输入确认人姓名',
      type: 'warning'
    })
    return
  }

  restartLoading.value = true
  try {
    const result = await runtimeApi.confirmRestart(restartTarget.value.id, {
      confirmedBy: confirmForm.confirmedBy,
      remark: confirmForm.remark || '手动重启'
    })

    // 閲嶅惎鎴愬姛鍚庯紝浠庢彁閱掑垪琛ㄤ腑绉婚櫎
    restartReminderIds.value.delete(restartTarget.value.id)

    // 鏇存柊鏈湴杩愯鏃堕暱淇℃伅
    if (result.counter) {
      runtimeMap.set(restartTarget.value.id, result.counter)
      applyRuntimeToDetector(result.counter)
    }

    await appDialog.alert({
      title: '重启确认完成',
      message: `重启成功：${result.message}`,
      type: 'success'
    })
    closeRestartConfirm()
  } catch (error: any) {
    console.error('重启失败:', error)
    await appDialog.alert({
      title: '重启失败',
      message: `重启失败：${error.message || '未知错误'}`,
      type: 'danger'
    })
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
  else canvasMap.delete(id)
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

watch(() => props.detectors, (newDetectors) => {
  if (newDetectors && newDetectors.length > 0) {
    runtimeMap.forEach(applyRuntimeToDetector)
    nextTick(drawAllCharts)
  }
}, { immediate: true })

watch(() => props.readerRuntimes, (runtimes) => {
  runtimeMap.clear()
  restartReminderIds.value.clear()
  runtimes.forEach((runtime) => {
    runtimeMap.set(runtime.readerId, runtime)
    if (runtime.reminderActive) {
      restartReminderIds.value.add(runtime.readerId)
    }
    applyRuntimeToDetector(runtime)
  })
}, { immediate: true })

onMounted(() => {
  setTimeout(drawAllCharts, 100)
  void fetchReplacementStatus()
  replacementRefreshInterval = setInterval(fetchReplacementStatus, 60000)
})

onUnmounted(() => {
  if (replacementRefreshInterval) clearInterval(replacementRefreshInterval)
  animationMap.forEach(id => cancelAnimationFrame(id))
  animationMap.clear()
  canvasMap.clear()
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
  gap: 18px;
}

.device-card {
  position: relative;
  overflow: hidden;
  background:
      linear-gradient(145deg, rgba(12, 30, 46, 0.08), transparent 42%),
      linear-gradient(180deg, var(--bg-card), var(--bg-secondary));
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: var(--transition);
  border: 1px solid var(--border-light);
  min-width: 0;
  box-shadow: 0 10px 28px rgba(8, 20, 36, 0.08);
}

.device-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 36px rgba(11, 78, 145, 0.14);
  border-color: var(--border-medium);
}

.device-card::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
      linear-gradient(rgba(40, 180, 255, 0.08) 1px, transparent 1px),
      linear-gradient(90deg, rgba(40, 180, 255, 0.06) 1px, transparent 1px);
  background-size: 28px 28px;
  mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.8), transparent 72%);
}

.card-scan {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(110deg, transparent 0%, rgba(50, 190, 255, 0.14) 45%, transparent 60%);
  transform: translateX(-120%);
  animation: card-scan 5.6s linear infinite;
  z-index: 0;
}

.device-card > *:not(.card-scan) {
  position: relative;
  z-index: 1;
}

@keyframes card-scan {
  0% { transform: translateX(-120%); }
  46%, 100% { transform: translateX(120%); }
}

/* 鐘舵€佽竟妗?*/
.device-card[data-status="unknown"] { border-top: 3px solid var(--text-muted); opacity: 0.85; }
.device-card[data-status="offline"] { border-top: 3px solid var(--border-heavy); opacity: 0.7; }
.device-card[data-status="connecting"] { border-top: 3px solid var(--info); box-shadow: 0 0 0 1px rgba(74, 144, 226, 0.08), 0 12px 30px rgba(74, 144, 226, 0.08); }
.device-card[data-status="online"] { border-top: 3px solid var(--success); box-shadow: 0 0 0 1px rgba(45, 106, 79, 0.08), 0 12px 30px rgba(45, 106, 79, 0.08); }
.device-card[data-status="warning"] { border-top: 3px solid var(--warning); box-shadow: 0 0 0 1px rgba(230, 160, 23, 0.12), 0 12px 30px rgba(230, 160, 23, 0.1); }
.device-card[data-status="fault"] { border-top: 3px solid var(--danger); box-shadow: 0 0 0 1px rgba(220, 53, 69, 0.14), 0 12px 30px rgba(220, 53, 69, 0.1); }
.device-card[data-status="maintenance"] { border-top: 3px solid var(--primary); }

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.device-name {
  font-size: 20px;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 2px;
  line-height: 1;
}

.device-id {
  font-size: 12px;
  color: var(--text-muted);
  font-family: monospace;
  min-height: 15px;
}

.status-dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  margin-top: 4px;
  box-shadow: 0 0 12px currentColor;
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

.card-main {
  display: grid;
  grid-template-columns: minmax(0, 1.34fr) minmax(0, 0.86fr);
  gap: 12px;
  margin-bottom: 12px;
}

.primary-metric {
  position: relative;
  min-width: 0;
  min-height: 118px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  padding: 14px 16px;
  border: 1px solid rgba(63, 175, 255, 0.22);
  border-radius: 10px;
  background:
      linear-gradient(135deg, rgba(47, 111, 237, 0.12), rgba(45, 106, 79, 0.06)),
      var(--bg-secondary);
}

.primary-metric::after {
  content: '';
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 8px;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, rgba(66, 184, 255, 0.8), transparent);
  opacity: 0.7;
}

.metric-label {
  color: var(--text-secondary);
  font-size: 15px;
  font-weight: 800;
}

.primary-metric strong {
  color: var(--text-primary);
  font-family: 'SF Mono', 'JetBrains Mono', monospace;
  font-size: 48px;
  font-weight: 900;
  line-height: 1;
  letter-spacing: 0;
  white-space: nowrap;
  text-shadow: 0 0 18px rgba(74, 144, 226, 0.2);
}

.primary-metric strong small {
  margin-left: 3px;
  color: var(--text-muted);
  font-size: 19px;
  font-weight: 800;
}

.primary-metric strong.danger,
.primary-metric strong .danger { color: var(--danger); }
.primary-metric strong.warning,
.primary-metric strong .warning { color: var(--warning); }
.primary-metric strong.normal { color: var(--success); }

.temperature-metric {
  order: 2;
}

.temperature-metric strong {
  font-size: 40px;
}

.success-metric {
  order: 1;
}

.success-metric.healthy strong { color: var(--success); }
.success-metric.warning strong { color: var(--warning); }
.success-metric.critical strong { color: var(--danger); }

.metric-sub {
  min-height: 18px;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  margin: 2px 0 12px;
}

.trend-canvas {
  width: 100%;
  height: 34px;
  border-radius: 6px;
  background:
      linear-gradient(90deg, rgba(47, 111, 237, 0.08), rgba(45, 106, 79, 0.08)),
      var(--bg-tertiary);
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.metric-cell {
  position: relative;
  min-width: 0;
  min-height: 72px;
  padding: 11px 12px;
  border: 1px solid rgba(63, 175, 255, 0.16);
  border-radius: 9px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(47, 111, 237, 0.06));
}

.metric-cell span {
  display: block;
  overflow: visible;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 800;
  line-height: 1.2;
  white-space: normal;
}

.metric-cell strong {
  display: block;
  margin-top: 9px;
  overflow: visible;
  color: var(--text-primary);
  font-family: 'SF Mono', 'JetBrains Mono', monospace;
  font-size: 29px;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
}

.metric-cell strong.warning {
  color: var(--warning);
}

.card-foot {
  display: grid;
  grid-template-columns: 1fr;
  align-items: stretch;
  gap: 6px;
}

.runtime-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 36px;
  padding: 7px 10px;
  border: 1px solid rgba(63, 175, 255, 0.14);
  border-radius: 8px;
  background: rgba(47, 111, 237, 0.05);
}

.runtime-strip span {
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 800;
}

.runtime-strip strong {
  color: var(--text-primary);
  font-family: 'SF Mono', 'JetBrains Mono', monospace;
  font-size: 18px;
  font-weight: 900;
}

.runtime-strip.warning strong {
  color: var(--warning);
}

.runtime-strip.danger strong {
  color: var(--danger);
}

.trigger-cycle-panel {
  margin: 8px 0;
  padding: 12px;
  border: 1px solid var(--border-light);
  border-radius: 10px;
  background: var(--bg-secondary);
  cursor: pointer;
}

.trigger-cycle-panel.healthy {
  border-color: rgba(45, 106, 79, 0.24);
  background: rgba(45, 106, 79, 0.07);
}

.trigger-cycle-panel.warning {
  border-color: rgba(230, 160, 23, 0.34);
  background: rgba(230, 160, 23, 0.09);
}

.trigger-cycle-panel.critical {
  border-color: rgba(220, 53, 69, 0.34);
  background: rgba(220, 53, 69, 0.08);
}

.trigger-cycle-panel.unknown {
  opacity: 0.82;
}

.trigger-cycle-main {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.trigger-cycle-label {
  color: var(--text-muted);
  font-size: 14px;
  font-weight: 700;
}

.trigger-cycle-main strong {
  color: var(--text-primary);
  font-family: 'SF Mono', 'JetBrains Mono', monospace;
  font-size: 30px;
  font-weight: 800;
  line-height: 1;
}

.trigger-cycle-panel.healthy .trigger-cycle-main strong {
  color: var(--success);
}

.trigger-cycle-panel.warning .trigger-cycle-main strong {
  color: var(--warning);
}

.trigger-cycle-panel.critical .trigger-cycle-main strong {
  color: var(--danger);
}

.trigger-cycle-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.trigger-cycle-metrics div {
  min-width: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.42);
}

.dark-theme .trigger-cycle-metrics div {
  background: rgba(15, 20, 25, 0.28);
}

.trigger-cycle-metrics span,
.trigger-cycle-foot span {
  display: block;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 700;
}

.trigger-cycle-metrics strong {
  display: block;
  margin-top: 4px;
  color: var(--text-primary);
  font-family: 'SF Mono', 'JetBrains Mono', monospace;
  font-size: 17px;
  font-weight: 800;
}

.trigger-cycle-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 10px;
}

.trigger-cycle-foot span:last-child {
  text-align: right;
}

/* 杩愯鏃堕暱鍖哄煙 */
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

.replacement-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 40px;
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(63, 175, 255, 0.14);
  background: rgba(47, 111, 237, 0.05);
}

.replacement-panel.replaced {
  background: rgba(45, 106, 79, 0.09);
  border: 1px solid rgba(45, 106, 79, 0.2);
}

.replacement-panel.pending {
  background: rgba(230, 160, 23, 0.09);
  border: 1px solid rgba(230, 160, 23, 0.24);
}

.replacement-copy {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.replacement-label {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
}

.replacement-copy strong {
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.2;
  font-weight: 800;
  white-space: nowrap;
}

.replacement-panel.replaced .replacement-copy strong {
  color: var(--success);
}

.replacement-panel.pending .replacement-copy strong {
  color: var(--warning);
}

.replacement-copy small {
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
}

.replacement-btn {
  flex-shrink: 0;
  border: 1px solid rgba(230, 160, 23, 0.5);
  color: #fff;
  background: linear-gradient(135deg, var(--warning), #d97706);
  border-radius: 6px;
  min-width: 72px;
  padding: 6px 12px;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  transition: var(--transition);
}

.replacement-btn:hover {
  filter: brightness(0.96);
  transform: translateY(-1px);
}

.replacement-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 閲嶅惎鎸夐挳鍖哄煙 */
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
  color: var(--text-muted);
  font-family: 'SF Mono', 'JetBrains Mono', monospace;
  font-size: 12px;
  text-align: right;
  white-space: nowrap;
  padding-right: 2px;
}

/* 閲嶅惎纭 Modal 鏍峰紡 */
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
