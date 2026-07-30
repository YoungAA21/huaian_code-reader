<template>
  <div ref="towerRef" class="digital-tower">
    <!-- 顶部：标题栏 + KPI 卡片 -->
    <HeaderSection
        :current-time="currentTime"
        :current-date="currentDate"
        :detectors="detectors"
        :threshold="THRESHOLD"
        :is-fullscreen="isFullscreen"
        :production-status="productionStatus"
        @toggle-fullscreen="toggleFullscreen"
    />

    <!-- 工控机状态卡片 -->
    <IpcStatus :realtime-status="ipcStatus" />

    <!-- 所有读码器网格 -->
    <div class="all-detectors-section">
      <div class="section-header">
        <div class="section-title">
          <span class="section-indicator"></span>
          <h2>所有读码器</h2>
          <span class="section-badge">{{ detectors.length }}台</span>
        </div>
        <div class="section-actions">
          <button
              type="button"
              class="manual-self-check-btn"
              :disabled="manualSelfCheckRunning"
              @click="startManualSelfCheck"
          >
            {{ manualSelfCheckRunning ? '自检中...' : '开机一键自检' }}
          </button>
          <div class="section-stats">
            <span class="stat-unknown">● 未知 {{ getStatusCount(0) }}</span>
            <span class="stat-offline">● 离线 {{ getStatusCount(1) }}</span>
            <span class="stat-connecting">● 连接中 {{ getStatusCount(2) }}</span>
            <span class="stat-online">● 在线 {{ getStatusCount(3) }}</span>
            <span class="stat-warning">● 警告 {{ getStatusCount(4) }}</span>
            <span class="stat-danger">● 故障 {{ getStatusCount(5) }}</span>
            <span class="stat-maintenance">● 维护 {{ getStatusCount(6) }}</span>
          </div>
        </div>
      </div>

      <DetectorGrid
          :detectors="detectors"
          :threshold="THRESHOLD"
          :reader-runtimes="readerRuntimes"
          @open-detail="openDetail"
          @config-threshold="openThresholdConfig"
      />
    </div>

    <!-- 板卡/IO 状态 -->
    <div class="io-status-section">
      <div class="section-header">
        <div class="section-title">
          <span class="section-indicator"></span>
          <h2>板卡/IO状态</h2>
          <span class="section-badge">{{ ioSignals.length }}点</span>
        </div>
        <div class="section-actions">
          <button
              type="button"
              class="io-replacement-btn"
              :disabled="ioBoardReplacementSubmitting"
              @click="recordIoBoardReplacement"
          >
            {{ ioBoardReplacementSubmitting ? '登记中...' : '登记IO板卡更换' }}
          </button>
        </div>
      </div>
      <div class="io-grid">
        <div
            v-for="item in ioSignals"
            :key="item.index"
            class="io-item"
            :class="item.active ? 'active' : 'inactive'"
            role="button"
            tabindex="0"
            @click="openIoHistory(item)"
            @keydown.enter="openIoHistory(item)"
            @keydown.space.prevent="openIoHistory(item)"
        >
          <span class="io-light"></span>
          <span class="io-content">
            <strong class="io-address">{{ item.address }}</strong>
            <span class="io-name">{{ item.name }}</span>
          </span>
          <span class="io-state">{{ item.active ? 'ON' : 'OFF' }}</span>
        </div>
      </div>
    </div>

    <!-- 底部：报警栏 -->
    <AlarmBar :alarms="latestAlarms" @clear="clearAllAlarms" />

    <!-- 详情弹窗 -->
    <DetailModal
        :detector="selectedDetector"
        @close="closeDetail"
    />

    <!-- 阈值配置弹窗 -->
    <ThresholdConfig
        :visible="thresholdConfigVisible"
        :detector="configTargetDetector"
        @close="closeThresholdConfig"
        @save="saveThresholdConfig"
    />

    <IoHistoryModal
        :visible="ioHistoryVisible"
        :point="selectedIoPoint"
        @close="closeIoHistory"
    />

    <div
        v-if="manualSelfCheckVisible"
        class="manual-self-check-overlay"
        @click.self="closeManualSelfCheck"
    >
      <section class="manual-self-check-dialog" role="dialog" aria-modal="true">
        <header class="manual-self-check-header">
          <div>
            <h2>开机一键自检</h2>
            <p>{{ manualSelfCheckSummary }}</p>
          </div>
          <button type="button" class="manual-self-check-close" @click="closeManualSelfCheck">×</button>
        </header>

        <div class="manual-self-check-body">
          <div class="manual-self-check-status" :class="manualSelfCheckLevel">
            <strong>{{ manualSelfCheckStatusText }}</strong>
            <span>{{ manualSelfCheckMessage }}</span>
          </div>

          <div v-if="manualSelfCheckBatch" class="manual-self-check-meta">
            <div>
              <span>批次号</span>
              <strong>{{ manualSelfCheckBatch.batchId }}</strong>
            </div>
            <div>
              <span>触发ACK</span>
              <strong>{{ manualSelfCheckBatch.serialAckOk ? '成功' : '未成功' }}</strong>
            </div>
            <div>
              <span>读码器</span>
              <strong>{{ manualSelfCheckBatch.receivedReaderCount }}/{{ manualSelfCheckBatch.expectedReaderCount }}</strong>
            </div>
            <div>
              <span>状态</span>
              <strong>{{ formatManualBatchStatus(manualSelfCheckBatch.status) }}</strong>
            </div>
          </div>

          <div class="manual-self-check-table-wrap">
            <table class="manual-self-check-table">
              <thead>
              <tr>
                <th>读码器</th>
                <th>结果</th>
                <th>耗时</th>
                <th>码值/信息</th>
              </tr>
              </thead>
              <tbody>
              <tr v-if="manualSelfCheckResults.length === 0">
                <td colspan="4" class="manual-self-check-empty">
                  {{ manualSelfCheckRunning ? '等待读码结果返回...' : '暂无本次自检结果' }}
                </td>
              </tr>
              <tr
                  v-for="item in manualSelfCheckResults"
                  :key="`${item.readerId}-${item.id}`"
                  :class="manualResultLevel(item.resultStatus)"
              >
                <td>
                  <strong>{{ item.readerName || item.readerId }}</strong>
                  <span>{{ item.readerId }}</span>
                </td>
                <td>{{ formatManualResultStatus(item.resultStatus) }}</td>
                <td>{{ item.elapsedMs == null ? '-' : `${item.elapsedMs} ms` }}</td>
                <td>{{ item.codeValue || item.message || item.rawText || '-' }}</td>
              </tr>
              </tbody>
            </table>
          </div>
        </div>

        <footer class="manual-self-check-footer">
          <button type="button" class="manual-self-check-secondary" @click="closeManualSelfCheck">关闭</button>
          <button
              type="button"
              class="manual-self-check-primary"
              :disabled="manualSelfCheckRunning"
              @click="startManualSelfCheck"
          >
            再次自检
          </button>
        </footer>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import HeaderSection from '../components/HeaderSection.vue'
import DetectorGrid from '../components/DetectorGrid.vue'
import AlarmBar from '../components/AlarmBar.vue'
import DetailModal from '../components/DetailModal.vue'
import IpcStatus from '../components/IpcStatus.vue'
import ThresholdConfig from '../components/ThresholdConfig.vue'
import IoHistoryModal, { type IoPoint } from '../components/IoHistoryModal.vue'
import type { ThresholdConfig as ThresholdConfigType } from '../components/ThresholdConfig.vue'
import type { Alarm } from '@/types/alarm'
import type { ReaderStatus } from '@/types/reader'
import { ReaderStatusMap } from '@/types/reader'
import type {Detector} from "@/types/detection.ts";
import type { ProductionStatus } from '@/types/production'
import type { IpcStatus as IpcStatusType } from '@/types/ipc'
import type { ReaderRuntime } from '@/types/runtime'
import type { ProductionStateRealtime, ReaderIntervalRealtimeDto } from '@/types/realtime'
import type {
  ManualTriggerBatch,
  ManualTriggerBatchStatusValue,
  ManualTriggerResult,
  ManualTriggerResultStatusValue,
} from '@/types/manualTrigger'
import type { ReaderTriggerIoStatus } from '@/types/realtime'
import signalRService from '@/utils/signal'
import { readerApi } from '@/api/reader'
import { manualTriggerApi } from '@/api/manualTrigger'
import { sparePartReplacementApi } from '@/api/sparePartReplacement'
import { useAppDialog } from '@/utils/appDialog'

// ==================== 配置 ====================
const THRESHOLD = { warning: 70, danger: 90 }
const MAX_TREND_POINTS = 30

// ==================== 响应式数据 ====================
const currentTime = ref('')
const currentDate = ref('')
const detectors = ref<any[]>([])
const selectedDetector = ref<any>(null)
const latestAlarms = ref<any[]>([])
const productionStatus = ref<ProductionStatus | null>(null)
const ipcStatus = ref<IpcStatusType | null>(null)
const readerRuntimes = ref<ReaderRuntime[]>([])
const ioSignalValues = ref<boolean[]>([])
const ioHistoryVisible = ref(false)
const selectedIoPoint = ref<IoPoint | null>(null)
const thresholdConfigVisible = ref(false)
const configTargetDetector = ref<any>(null)
const towerRef = ref<HTMLElement | null>(null)
const isFullscreen = ref(false)
const ioBoardReplacementSubmitting = ref(false)
const manualSelfCheckRunning = ref(false)
const manualSelfCheckVisible = ref(false)
const manualSelfCheckBatch = ref<ManualTriggerBatch | null>(null)
const manualSelfCheckResults = ref<ManualTriggerResult[]>([])
const manualSelfCheckMessage = ref('等待发起自检')
let manualSelfCheckTimer: number | null = null
const appDialog = useAppDialog()
const savedThresholds = JSON.parse(localStorage.getItem('device_thresholds') || '{}')
let hasLoggedFirstSignalRPayload = false
let lastSignalRLogTime = 0

const getCurrentLineId = () => ipcStatus.value?.lineId || productionStatus.value?.lineId || 'LINE03'

const formatLocalDateTime = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
      `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

const IO_POINT_CONFIG = [
  { point: 1, address: 'X2-2', name: '导轨2读码器拍照' },
  { point: 3, address: 'X2-4', name: '条盒拍照信号' },
  { point: 8, address: 'X2-9', name: '工控机开关信号' },
  { point: 17, address: 'X4-2', name: '二维码系统故障' },
  { point: 19, address: 'X4-4', name: '二维码启动信号' },
  { point: 21, address: 'X4-6', name: '关联失败剔除' },
  { point: 22, address: 'X4-7', name: '导轨1读码器拍照' },
  { point: 23, address: 'X4-8', name: '条包移位信号' },
  { point: 24, address: 'X4-9', name: '导轨1验码拍照' },
  { point: 25, address: 'X5-2', name: '4#读码器拍照' },
  { point: 26, address: 'X5-3', name: '备用' },
  { point: 29, address: 'X5-6', name: 'HMI初始化信号' }
] as const

const toggleFullscreen = async () => {
  try {
    if (!document.fullscreenElement) {
      await towerRef.value?.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
  } catch (error) {
    console.error('切换全屏失败:', error)
  }
}

const handleFullscreenChange = () => {
  isFullscreen.value = document.fullscreenElement === towerRef.value
}

const ioSignals = computed(() => {
  const signals = ioSignalValues.value
  return IO_POINT_CONFIG.map(item => ({
    point: item.point,
    index: item.point - 1,
    address: item.address,
    name: item.name,
    active: Boolean(signals[item.point - 1])
  }))
})

const openIoHistory = (point: IoPoint) => {
  selectedIoPoint.value = point
  ioHistoryVisible.value = true
}

const closeIoHistory = () => {
  ioHistoryVisible.value = false
  selectedIoPoint.value = null
}

const batchStatusNameMap: Record<string, string> = {
  '1': 'CommandSent',
  '2': 'WaitingReaderResults',
  '3': 'Completed',
  '4': 'Timeout',
  '5': 'Failed',
  CommandSent: 'CommandSent',
  WaitingReaderResults: 'WaitingReaderResults',
  Completed: 'Completed',
  Timeout: 'Timeout',
  Failed: 'Failed'
}

const batchStatusTextMap: Record<string, string> = {
  CommandSent: '指令已发送',
  WaitingReaderResults: '触发成功，等待读码',
  Completed: '自检完成',
  Timeout: '读码结果超时',
  Failed: '触发链路失败'
}

const resultStatusNameMap: Record<string, string> = {
  '1': 'Waiting',
  '2': 'ValidCode',
  '3': 'NoRead',
  '4': 'DecodeFail',
  '5': 'ReaderTimeout',
  '6': 'TriggerCommandTimeout',
  Waiting: 'Waiting',
  ValidCode: 'ValidCode',
  NoRead: 'NoRead',
  DecodeFail: 'DecodeFail',
  ReaderTimeout: 'ReaderTimeout',
  TriggerCommandTimeout: 'TriggerCommandTimeout'
}

const resultStatusTextMap: Record<string, string> = {
  Waiting: '等待结果',
  ValidCode: '读到码',
  NoRead: '未读到',
  DecodeFail: '解码失败',
  ReaderTimeout: 'TCP未返回',
  TriggerCommandTimeout: 'ACK未反转'
}

const normalizeManualBatchStatus = (status: ManualTriggerBatchStatusValue) =>
    batchStatusNameMap[String(status)] || String(status)

const normalizeManualResultStatus = (status: ManualTriggerResultStatusValue) =>
    resultStatusNameMap[String(status)] || String(status)

const formatManualBatchStatus = (status: ManualTriggerBatchStatusValue) => {
  const normalized = normalizeManualBatchStatus(status)
  return batchStatusTextMap[normalized] || normalized
}

const formatManualResultStatus = (status: ManualTriggerResultStatusValue) => {
  const normalized = normalizeManualResultStatus(status)
  return resultStatusTextMap[normalized] || normalized
}

const manualBatchIsTerminal = (batch: ManualTriggerBatch) => {
  const status = normalizeManualBatchStatus(batch.status)
  return status === 'Completed' || status === 'Timeout' || status === 'Failed'
}

const manualResultLevel = (status: ManualTriggerResultStatusValue) => {
  const normalized = normalizeManualResultStatus(status)
  if (normalized === 'ValidCode') return 'success'
  if (normalized === 'NoRead' || normalized === 'DecodeFail') return 'warning'
  if (normalized === 'ReaderTimeout' || normalized === 'TriggerCommandTimeout') return 'danger'
  return 'info'
}

const clearManualSelfCheckTimer = () => {
  if (manualSelfCheckTimer != null) {
    window.clearTimeout(manualSelfCheckTimer)
    manualSelfCheckTimer = null
  }
}

const hasManualSelfCheckFailure = computed(() => {
  const batch = manualSelfCheckBatch.value
  if (!batch) return false
  const status = normalizeManualBatchStatus(batch.status)
  return status === 'Failed' ||
      status === 'Timeout' ||
      !batch.serialAckOk ||
      manualSelfCheckResults.value.some(item => {
        const resultStatus = normalizeManualResultStatus(item.resultStatus)
        return resultStatus === 'ReaderTimeout' || resultStatus === 'TriggerCommandTimeout'
      })
})

const hasManualSelfCheckWarning = computed(() =>
    manualSelfCheckResults.value.some(item => {
      const resultStatus = normalizeManualResultStatus(item.resultStatus)
      return resultStatus === 'NoRead' || resultStatus === 'DecodeFail'
    })
)

const manualSelfCheckLevel = computed(() => {
  if (manualSelfCheckRunning.value) return 'info'
  if (hasManualSelfCheckFailure.value) return 'danger'
  if (hasManualSelfCheckWarning.value) return 'warning'
  if (manualSelfCheckBatch.value) return 'success'
  return 'info'
})

const manualSelfCheckStatusText = computed(() => {
  if (manualSelfCheckRunning.value) return '自检执行中'
  if (hasManualSelfCheckFailure.value) return '自检失败'
  if (hasManualSelfCheckWarning.value) return '自检完成，有异常'
  if (manualSelfCheckBatch.value) return '自检通过'
  return '未开始'
})

const manualSelfCheckSummary = computed(() => {
  const batch = manualSelfCheckBatch.value
  if (!batch) return '发起后自动查询触发状态和每台读码器结果'
  return `${formatManualBatchStatus(batch.status)} · ${batch.receivedReaderCount}/${batch.expectedReaderCount} 台`
})

const closeManualSelfCheck = () => {
  manualSelfCheckVisible.value = false
  if (!manualSelfCheckRunning.value) {
    clearManualSelfCheckTimer()
  }
}

const refreshManualSelfCheck = async (batchId: string, startedAt: number) => {
  const batch = await manualTriggerApi.getBatch(batchId)
  manualSelfCheckBatch.value = batch
  manualSelfCheckMessage.value = batch.errorMessage || batch.serialAckMessage || formatManualBatchStatus(batch.status)

  try {
    const resultResponse = await manualTriggerApi.getResults(batchId)
    manualSelfCheckResults.value = resultResponse.items || []
  } catch (error) {
    console.warn('查询开机自检读码结果失败:', error)
  }

  if (manualBatchIsTerminal(batch)) {
    manualSelfCheckRunning.value = false
    clearManualSelfCheckTimer()
    return
  }

  if (Date.now() - startedAt > 20000) {
    manualSelfCheckRunning.value = false
    manualSelfCheckMessage.value = '自检查询超时，请稍后查看批次结果'
    clearManualSelfCheckTimer()
    return
  }

  manualSelfCheckTimer = window.setTimeout(() => {
    void refreshManualSelfCheck(batchId, startedAt)
  }, 800)
}

const startManualSelfCheck = async () => {
  if (manualSelfCheckRunning.value) return

  clearManualSelfCheckTimer()
  manualSelfCheckVisible.value = true
  manualSelfCheckRunning.value = true
  manualSelfCheckBatch.value = null
  manualSelfCheckResults.value = []
  manualSelfCheckMessage.value = '正在发送自检触发指令...'

  try {
    const response = await manualTriggerApi.startAllReaders({
      requestedBy: 'operator',
      remark: '开机一键自检'
    })

    manualSelfCheckMessage.value = response.message || '触发指令已入队，等待ACK反转'
    await refreshManualSelfCheck(response.batchId, Date.now())
  } catch (error: any) {
    manualSelfCheckRunning.value = false
    clearManualSelfCheckTimer()
    const message = error.response?.data?.message || error.message || '开机自检请求失败'
    manualSelfCheckMessage.value = message
    await appDialog.alert({
      title: '开机一键自检失败',
      message,
      type: 'danger'
    })
  }
}

const recordIoBoardReplacement = async () => {
  if (ioBoardReplacementSubmitting.value) return

  const lineId = getCurrentLineId()
  const locationId = `${lineId}-IO-CABINET`

  ioBoardReplacementSubmitting.value = true
  try {
    const result = await sparePartReplacementApi.recordReplacement({
      locationId,
      sparePartName: `${lineId} IO板卡`,
      sparePartType: 'IO',
      replacementTime: formatLocalDateTime(new Date()),
      replacedBy: '操作员',
      remark: '首页快捷登记IO板卡更换'
    })

    await appDialog.alert({
      title: 'IO板卡更换',
      message: result.message,
      type: 'success'
    })
  } catch (error: any) {
    console.error('登记IO板卡更换失败:', error)
    await appDialog.alert({
      title: '登记失败',
      message: `登记IO板卡更换失败：${error.response?.data?.message || error.message || '未知错误'}`,
      type: 'danger'
    })
  } finally {
    ioBoardReplacementSubmitting.value = false
  }
}

const updateIoSignals = (payload: any) => {
  const signals = Array.isArray(payload) ? payload : payload?.ioSignals
  if (!Array.isArray(signals)) return
  ioSignalValues.value = signals.slice(0, 32).map(Boolean)
}

const readerStatusNameMap: Record<string, number> = {
  Unknown: 0,
  Offline: 1,
  Disconnected: 1,
  Connecting: 2,
  Online: 3,
  Healthy: 3,
  Warning: 4,
  Critical: 5,
  Fault: 5,
  Error: 5,
  Maintenance: 6,
  Disabled: 6
}

const normalizeReaderStatusCode = (reader: Pick<ReaderStatus, 'status' | 'enabled' | 'tcpConnected'>) => {
  if (!reader.enabled) return 6
  if (typeof reader.status === 'number') return reader.status
  const mapped = readerStatusNameMap[String(reader.status)]
  if (mapped !== undefined) return mapped
  if (reader.tcpConnected) return 3
  return 0
}

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

const convertReaderIntervalToReaderStatus = (
    reader: ReaderIntervalRealtimeDto,
    snapshot: ProductionStateRealtime
): ReaderStatus => ({
  readerId: reader.readerId,
  name: reader.name || reader.readerId,
  ip: '',
  tcpPort: 0,
  enabled: Boolean(reader.enabled),
  tcpConnected: Boolean(reader.tcpConnected),
  tcpConnectedTime: null,
  lastReconnectRequestTime: null,
  pingOk: Boolean(reader.pingOk),
  modbusOk: Boolean(reader.modbusOk),
  reconnectRequested: false,
  reconnectReason: null,
  reconnectRequestedTime: null,
  lastReceiveTime: reader.lastReceiveTime,
  lastBusinessResultTime: reader.lastBusinessResultTime,
  lastValidCodeTime: reader.lastValidCodeTime,
  lastHeartbeatTime: null,
  lastReceiveType: reader.lastReceiveType || 'Unknown',
  lastRawText: null,
  lastValidCodeIntervalMs: reader.lastValidCodeIntervalMs,
  recentAverageValidCodeIntervalMs: reader.recentAverageValidCodeIntervalMs,
  recentIntervalCount: toFiniteNumber(reader.recentIntervalCount),
  currentTemperature: reader.currentTemperature,
  status: normalizeReaderStatusCode(reader),
  message: reader.message || '',
  updatedTime: reader.updatedTime || snapshot.updatedTime,
  lineId: snapshot.lineId
} as ReaderStatus)

const convertReaderIntervalToRuntime = (
    reader: ReaderIntervalRealtimeDto,
    snapshot: ProductionStateRealtime
): ReaderRuntime => {
  const accumulatedHours = toFiniteNumber(reader.accumulatedHours)
  const thresholdHours = toFiniteNumber(reader.runtimeThresholdHours)
  const accumulatedSeconds = Math.round(accumulatedHours * 3600)
  const reminderThresholdSeconds = Math.round(thresholdHours * 3600)

  return {
    workshopId: snapshot.workshopId,
    lineId: snapshot.lineId,
    ipcId: snapshot.ipcId,
    readerId: reader.readerId,
    readerName: reader.name || reader.readerId,
    enabled: Boolean(reader.enabled),
    accumulatedSeconds,
    reminderThresholdSeconds,
    reminderActive: Boolean(reader.runtimeReminderActive),
    isAccumulating: Boolean(reader.runtimeIsAccumulating),
    lastAccumulationTime: null,
    lastConfirmedTime: reader.runtimeLastConfirmedTime,
    lastConfirmedBy: null,
    lastConfirmRemark: null,
    updatedTime: reader.updatedTime || snapshot.updatedTime,
    accumulatedHours,
    thresholdHours,
    remainingSeconds: toFiniteNumber(reader.runtimeRemainingSeconds)
  }
}

// ==================== 将 API 读码器数据转换为组件格式 ====================
// 将 API 读码器数据转换为组件格式（传递全部字段）
const convertReaderToDetector = (reader: ReaderStatus): Detector => {
  const statusCode = normalizeReaderStatusCode(reader)
  const statusMeta = ReaderStatusMap[statusCode] || ReaderStatusMap[0]
  const isOnline = statusCode === 3
  const savedThreshold = savedThresholds[reader.readerId]

  const displayValue = reader.lastValidCodeIntervalMs ?? 0
  const temperature = reader.currentTemperature ?? 0

  return {
    // 基础信息
    id: reader.readerId,
    name: reader.name || reader.readerId,
    device: reader.readerId,
    lineName: (reader as any).lineId || '',
    stationName: reader.name,

    // 状态信息
    status: statusMeta.color,
    statusText: statusMeta.text,
    isConnected: isOnline,
    wasOnline: isOnline,

    // 数值信息
    displayValue: displayValue,
    lastValue: displayValue,
    trend: 0,
    changeRate: 0,
    maxValue: displayValue,
    minValue: displayValue,
    avgValue: displayValue,

    // 温度
    temperature,
    lastTempWarning: false,

    // 时间相关（全部传递）
    lastHeartbeat: reader.lastHeartbeatTime,
    lastUpdateTime: new Date(reader.updatedTime).toLocaleTimeString(),
    lastValidCodeTime: reader.lastValidCodeTime,
    lastReceiveTime: reader.lastReceiveTime,
    tcpConnectedTime: reader.tcpConnectedTime,
    lastBusinessResultTime: reader.lastBusinessResultTime,
    updatedTime: reader.updatedTime,

    // 计数相关
    lastTriggerIndex: reader.recentIntervalCount ?? 0,
    lastTotalTime: reader.lastValidCodeIntervalMs ?? 0,
    recentIntervalCount: reader.recentIntervalCount,
    lastValidCodeIntervalMs: reader.lastValidCodeIntervalMs,
    recentAverageValidCodeIntervalMs: reader.recentAverageValidCodeIntervalMs,
    triggerCycleHealthStatus: undefined,
    triggerCycleHealthReasons: [],
    triggerSuccessRate: null,
    triggerEffectiveSuccessRate: null,
    triggerLateRecoveredRate: null,
    triggerLateRecoveredCount: 0,
    triggerLastSuccessDelayMs: null,
    triggerLastReceiveIntervalMs: null,
    triggerLastIntervalMs: null,
    triggerCount: 0,
    triggerMatchedCount: 0,
    triggerSettledCycleCount: 0,
    triggerPendingCount: 0,
    triggerPendingNoResultCount: 0,
    triggerConsecutiveNoResultCount: 0,
    triggerConsecutiveBadCycleCount: 0,
    triggerLastLateOffsetCycles: null,
    triggerLastCycleStatus: null,

    // 码值相关
    lastCode: reader.lastRawText || '',
    lastRawText: reader.lastRawText,
    lastReceiveType: reader.lastReceiveType,

    // 网络连接信息
    ip: reader.ip,
    tcpPort: reader.tcpPort,
    tcpConnected: reader.tcpConnected,
    pingOk: reader.pingOk,
    modbusOk: reader.modbusOk,
    enabled: reader.enabled,

    // 重连信息
    lastReconnectRequestTime: reader.lastReconnectRequestTime,
    reconnectRequested: reader.reconnectRequested,
    reconnectReason: reader.reconnectReason,
    reconnectRequestedTime: reader.reconnectRequestedTime,

    // 其他
    message: reader.message,
    status_code: statusCode,

    // 告警和趋势数据
    alarms: [],
    trendData: [temperature],
    valueBuffer: [displayValue],
    lastRenderTime: Date.now(),

    customThreshold: savedThreshold ? {
      warning: savedThreshold.warning ?? THRESHOLD.warning,
      danger: savedThreshold.danger
    } : undefined,
    customTempThreshold: savedThreshold ? {
      warning: savedThreshold.tempWarning ?? 45,
      danger: savedThreshold.tempDanger ?? 60
    } : undefined,

    // 原始数据
    rawReader: reader
  }
}

const updateReadersStatus = (readers: ReaderStatus[]) => {
  if (!readers || readers.length === 0) {
    detectors.value = []
    return
  }

      const newDetectors = readers.map(convertReaderToDetector)

      // 保留原有的自定义阈值和告警历史
      newDetectors.forEach(newDetector => {
        const oldDetector = detectors.value.find(d => d.id === newDetector.id)
        if (oldDetector) {
          // 使用类型断言或可选链
          newDetector.customThreshold = oldDetector.customThreshold
          newDetector.customTempThreshold = oldDetector.customTempThreshold
          newDetector.alarms = oldDetector.alarms || []
          newDetector.trendData = oldDetector.trendData || [newDetector.temperature]
          newDetector.valueBuffer = oldDetector.valueBuffer || []

          const runtimeFields = [
            'workshopId',
            'lineId',
            'ipcId',
            'readerName',
            'runtimeHours',
            'accumulatedSeconds',
            'remainingSeconds',
            'reminderActive',
            'thresholdHours',
            'reminderThresholdSeconds',
            'isAccumulating',
            'runtimeUpdatedTime',
            'triggerCycleHealthStatus',
            'triggerCycleHealthReasons',
            'triggerSuccessRate',
            'triggerEffectiveSuccessRate',
            'triggerLateRecoveredRate',
            'triggerLateRecoveredCount',
            'triggerLastSuccessDelayMs',
            'triggerLastReceiveIntervalMs',
            'triggerLastIntervalMs',
            'triggerCount',
            'triggerMatchedCount',
            'triggerSettledCycleCount',
            'triggerPendingCount',
            'triggerPendingNoResultCount',
            'triggerConsecutiveNoResultCount',
            'triggerConsecutiveBadCycleCount',
            'triggerLastLateOffsetCycles',
            'triggerLastCycleStatus'
          ] as const
          runtimeFields.forEach((field) => {
            if (oldDetector[field] !== undefined) {
              ;(newDetector as any)[field] = oldDetector[field]
            }
          })
          if (oldDetector.lineId || oldDetector.lineName) {
            newDetector.lineName = oldDetector.lineName || oldDetector.lineId
          }

          if (newDetector.updatedTime !== oldDetector.updatedTime) {
            newDetector.trendData.push(newDetector.temperature)
            if (newDetector.trendData.length > MAX_TREND_POINTS) {
              newDetector.trendData.splice(0, newDetector.trendData.length - MAX_TREND_POINTS)
            }

            const lastValue = oldDetector.temperature ?? newDetector.temperature
            newDetector.trend = newDetector.temperature - lastValue
            if (lastValue !== 0) {
              newDetector.changeRate = (newDetector.trend / Math.abs(lastValue)) * 100
            }

            newDetector.valueBuffer.push(newDetector.displayValue)
            newDetector.maxValue = Math.max(newDetector.displayValue, oldDetector.maxValue ?? newDetector.displayValue)
            newDetector.minValue = Math.min(newDetector.displayValue, oldDetector.minValue ?? newDetector.displayValue)
          } else {
            newDetector.trend = oldDetector.trend
            newDetector.changeRate = oldDetector.changeRate
            newDetector.maxValue = oldDetector.maxValue
            newDetector.minValue = oldDetector.minValue
            newDetector.avgValue = oldDetector.avgValue
          }
          newDetector.lastValue = oldDetector.displayValue
        }
      })

      detectors.value = newDetectors

      if (configTargetDetector.value) {
        configTargetDetector.value = newDetectors.find(d => d.id === configTargetDetector.value.id) || null
      }
}

const applyTriggerCyclesToDetectors = (triggerCycles: ReaderTriggerIoStatus[] | undefined) => {
  if (!Array.isArray(triggerCycles) || triggerCycles.length === 0) return

  const cycleMap = new Map<string, ReaderTriggerIoStatus>()
  triggerCycles.forEach((cycle) => {
    if (!cycle.readerId) return
    cycleMap.set(cycle.readerId.toUpperCase(), cycle)
  })

  detectors.value.forEach((detector) => {
    const cycle = cycleMap.get(String(detector.id).toUpperCase())
    if (!cycle) return

    detector.triggerCycleHealthStatus = cycle.healthStatus
    detector.triggerCycleHealthReasons = cycle.healthReasons || []
    detector.triggerSuccessRate = cycle.successRate
    detector.triggerEffectiveSuccessRate = cycle.effectiveSuccessRate ?? cycle.successRate
    detector.triggerLateRecoveredRate = cycle.lateRecoveredRate ?? null
    detector.triggerLateRecoveredCount = cycle.lateRecoveredCount ?? 0
    detector.triggerLastSuccessDelayMs = cycle.lastSuccessDelayMs
    detector.triggerLastReceiveIntervalMs = cycle.lastReceiveIntervalMs
    detector.triggerLastIntervalMs = cycle.lastIntervalMs
    detector.triggerCount = cycle.triggerCount
    detector.triggerMatchedCount = cycle.matchedCount
    detector.triggerSettledCycleCount = cycle.settledCycleCount
    detector.triggerPendingCount = cycle.pendingTriggerCount
    detector.triggerPendingNoResultCount = cycle.pendingNoResultCount ?? 0
    detector.triggerConsecutiveNoResultCount = cycle.consecutiveNoResultCount
    detector.triggerConsecutiveBadCycleCount = cycle.consecutiveBadCycleCount
    detector.triggerLastLateOffsetCycles = cycle.lastLateOffsetCycles ?? null
    detector.triggerLastCycleStatus = cycle.lastCycleStatus || null
  })
}

// ==================== 告警数据转换函数 ====================
const convertApiAlarmToComponentFormat = (apiAlarm: Alarm) => {
  let level = 'warning'
  if (apiAlarm.level === 1) {
    level = 'warning'
  } else if (apiAlarm.level >= 2) {
    level = 'danger'
  }

  let detectorName = apiAlarm.readerId || '未知设备'
  const readerMatch = apiAlarm.message.match(/读码器\s+(\S+)/)
  if (readerMatch) {
    detectorName = readerMatch[1]
  }

  return {
    id: apiAlarm.id,
    time: new Date(apiAlarm.startTime).toLocaleTimeString('zh-CN', { hour12: false }),
    level: level,
    message: apiAlarm.message,
    value: 0,
    detectorName: detectorName,
    timestamp: new Date(apiAlarm.startTime).getTime()
  }
}

const handleProductionState = (snapshot: ProductionStateRealtime) => {
  const now = Date.now()
  if (!hasLoggedFirstSignalRPayload) {
    console.log('[SignalR] productionState:', snapshot)
    hasLoggedFirstSignalRPayload = true
    lastSignalRLogTime = now
  } else if (now - lastSignalRLogTime >= 60000) {
    console.log('[SignalR] 通讯正常:', {
      updatedTime: snapshot.updatedTime,
      runState: snapshot.runState,
      readerCount: snapshot.readerIntervals?.length ?? snapshot.readers?.length ?? 0,
      triggerCycleCount: snapshot.triggerCycles?.length ?? 0,
      alarmCount: snapshot.activeAlarms?.length ?? 0
    })
    lastSignalRLogTime = now
  }
  productionStatus.value = snapshot
  ipcStatus.value = snapshot.ipc
  latestAlarms.value = (snapshot.activeAlarms || []).map(convertApiAlarmToComponentFormat)
  updateIoSignals(snapshot)

  const realtimeReaders = Array.isArray(snapshot.readerIntervals)
      ? snapshot.readerIntervals.map(reader => convertReaderIntervalToReaderStatus(reader, snapshot))
      : []
  const readers = realtimeReaders.length > 0 ? realtimeReaders : (snapshot.readers || [])
  const realtimeRuntimes = Array.isArray(snapshot.readerIntervals)
      ? snapshot.readerIntervals.map(reader => convertReaderIntervalToRuntime(reader, snapshot))
      : []
  readerRuntimes.value = realtimeRuntimes.length > 0 ? realtimeRuntimes : (snapshot.readerRuntimes || [])

  if (readers.length > 0) {
    updateReadersStatus(readers)
  }
  applyTriggerCyclesToDetectors(snapshot.triggerCycles)

}

const clearAllAlarms = () => {
  latestAlarms.value = []
}

// ==================== 计算属性 - 所有读码器统计 ====================
const getStatusCount = (statusCode: number) => {
  return detectors.value.filter(d => d.status_code === statusCode).length
}

// ==================== 辅助函数 ====================
const formatTime = () => {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString('zh-CN', { hour12: false })
  currentDate.value = now.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', weekday: 'short' })
}

// ==================== 更新统计 ====================
const updateStatistics = () => {
  detectors.value.forEach(detector => {
    if (detector.valueBuffer && detector.valueBuffer.length > 0) {
      const sum = detector.valueBuffer.reduce((a: any, b: any) => a + b, 0)
      detector.avgValue = sum / detector.valueBuffer.length
      detector.valueBuffer = []
    }
  })
}

// ==================== 阈值配置 ====================
const openDetail = (detector: any) => {
  selectedDetector.value = {
    ...detector,
    alarms: [...(detector.alarms || [])],
    trendData: [...(detector.trendData || [])],
    valueBuffer: [...(detector.valueBuffer || [])],
    rawReader: detector.rawReader ? { ...detector.rawReader } : detector.rawReader
  }
}
const closeDetail = () => { selectedDetector.value = null }

const openThresholdConfig = (detector: any) => {
  configTargetDetector.value = detector
  thresholdConfigVisible.value = true
}

const closeThresholdConfig = () => {
  thresholdConfigVisible.value = false
  configTargetDetector.value = null
}

const saveThresholdConfig = (detectorId: string, config: ThresholdConfigType) => {
  const detector = detectors.value.find(d => d.id === detectorId)
  if (detector) {
    // 删除 customThreshold 相关代码，因为不再需要解码耗时阈值
    detector.customTempThreshold = {
      warning: detector.customTempThreshold?.warning ?? 45,
      danger: config.tempDanger
    }

    savedThresholds[detectorId] = config
    localStorage.setItem('device_thresholds', JSON.stringify(savedThresholds))
  }
}

// ==================== 生命周期 ====================
let statsInterval: any
let clockInterval: any
let readerStatusInterval: any
let readerStatusLoading = false

const refreshReaderStatus = async () => {
  if (readerStatusLoading) return
  readerStatusLoading = true
  try {
    updateReadersStatus(await readerApi.getReadersStatus())
  } catch (error) {
    console.error('读取读码器状态失败:', error)
  } finally {
    readerStatusLoading = false
  }
}

onMounted(async () => {
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  formatTime()
  clockInterval = setInterval(formatTime, 1000)

  // SignalR 首帧可能因重连或路由切换延迟，先用 REST 恢复读码器列表。
  await refreshReaderStatus()
  readerStatusInterval = setInterval(refreshReaderStatus, 5000)

  signalRService.buildConnection(
      import.meta.env.VITE_SIGNALR_HUB_URL || '/hubs/production-state'
  )
  signalRService.on<ProductionStateRealtime>('productionState', handleProductionState)
  try {
    await signalRService.start()
  } catch (error) {
    console.error('SignalR 实时监测连接失败:', error)
  }

  statsInterval = setInterval(updateStatistics, 2000)
})

onUnmounted(async () => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  clearInterval(clockInterval)
  clearInterval(statsInterval)
  clearInterval(readerStatusInterval)
  clearManualSelfCheckTimer()
  signalRService.off('productionState', handleProductionState)
  await signalRService.stop()
})
</script>

<!-- 样式保持不变 -->
<style>
/* ==================== 全局主题变量 ==================== */
:root {
  --bg-primary: #f5f7fa;
  --bg-secondary: #ffffff;
  --bg-tertiary: #e8ecef;
  --bg-card: #ffffff;
  --primary: #2f6fed;
  --primary-soft: rgba(47, 111, 237, 0.12);
  --text-primary: #1a2a3a;
  --text-secondary: #6c7a8a;
  --text-muted: #9aaebf;
  --text-inverse: #ffffff;
  --border-light: #e0e4e8;
  --border-medium: #cbd5e0;
  --border-heavy: #adb5bd;
  --success: #2d6a4f;
  --success-light: #52b788;
  --warning: #e6a017;
  --warning-light: #ffc107;
  --danger: #dc3545;
  --danger-light: #ff6b6b;
  --info: #4a90e2;
  --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.12);
  --transition: all 0.2s ease;
}

.dark-theme {
  --bg-primary: #0f1419;
  --bg-secondary: #171e26;
  --bg-tertiary: #202936;
  --bg-card: #171e26;
  --primary: #6f9cff;
  --primary-soft: rgba(111, 156, 255, 0.14);
  --text-primary: #e0e4e8;
  --text-secondary: #b4c0cc;
  --text-muted: #8291a3;
  --text-inverse: #1a2a3a;
  --border-light: #2a343c;
  --border-medium: #3a4550;
  --border-heavy: #4a5560;
  --success: #52b788;
  --success-light: #2d6a4f;
  --warning: #ffc107;
  --warning-light: #e6a017;
  --danger: #ff6b6b;
  --danger-light: #dc3545;
  --info: #5a9ef0;
  --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.2);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.4);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  background: var(--bg-primary);
  transition: background-color 0.3s ease, color 0.3s ease;
}
</style>

<style scoped>
.digital-tower {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  background: var(--bg-primary);
  padding: 24px 32px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  font-size: 16px;
  color: var(--text-primary);
  overflow-y: auto;
  box-sizing: border-box;
}

.digital-tower::-webkit-scrollbar {
  width: 6px;
  background: var(--border-light);
  border-radius: 3px;
}

.digital-tower::-webkit-scrollbar-thumb {
  background: var(--text-muted);
  border-radius: 3px;
}

.digital-tower::-webkit-scrollbar-thumb:hover {
  background: var(--border-heavy);
}

/* 所有读码器区域 */
.all-detectors-section {
  margin-bottom: 40px;
}

.io-status-section {
  margin-bottom: 80px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 0 4px;
  gap: 16px;
}

.section-title {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-shrink: 0;
}

.section-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  min-width: 0;
}

.section-indicator {
  width: 4px;
  height: 22px;
  background: var(--primary);
  border-radius: 2px;
}

.section-title h2 {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
  letter-spacing: 0;
}

.section-badge {
  font-size: 15px;
  color: var(--text-muted);
  background: var(--bg-tertiary);
  padding: 2px 8px;
  border-radius: 20px;
}

.section-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  font-size: 16px;
  font-weight: 500;
}

.section-stats span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.stat-unknown { color: var(--text-muted); }
.stat-offline { color: var(--border-heavy); }
.stat-connecting { color: var(--info); }
.stat-online { color: var(--success); }
.stat-warning { color: var(--warning); }
.stat-danger { color: var(--danger); }
.stat-maintenance { color: var(--primary); }

.manual-self-check-btn {
  min-height: 38px;
  border: 1px solid rgba(47, 111, 237, 0.45);
  border-radius: 9px;
  background: linear-gradient(135deg, var(--primary), #1d4ed8);
  color: #fff;
  padding: 8px 16px;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 0 4px 10px rgba(47, 111, 237, 0.18);
  transition: var(--transition);
}

.manual-self-check-btn:hover:not(:disabled) {
  filter: brightness(0.98);
  transform: translateY(-1px);
}

.manual-self-check-btn:disabled {
  opacity: 0.62;
  cursor: not-allowed;
}

.io-replacement-btn {
  min-height: 38px;
  border: 1px solid rgba(230, 160, 23, 0.5);
  border-radius: 9px;
  background: linear-gradient(135deg, var(--warning), #d97706);
  color: #fff;
  padding: 8px 14px;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(217, 119, 6, 0.18);
  transition: var(--transition);
}

.io-replacement-btn:hover:not(:disabled) {
  filter: brightness(0.96);
  transform: translateY(-1px);
}

.io-replacement-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.manual-self-check-overlay {
  position: fixed;
  inset: 0;
  z-index: 2600;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px;
  background: rgba(8, 14, 24, 0.62);
  backdrop-filter: blur(5px);
}

.manual-self-check-dialog {
  width: min(920px, 100%);
  max-height: min(760px, calc(100vh - 56px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-medium);
  border-radius: 10px;
  background: var(--bg-card);
  color: var(--text-primary);
  box-shadow: var(--shadow-lg);
}

.manual-self-check-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 22px 16px;
  border-bottom: 1px solid var(--border-light);
}

.manual-self-check-header h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 0;
}

.manual-self-check-header p {
  margin: 6px 0 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.manual-self-check-close {
  width: 36px;
  height: 36px;
  border: 1px solid var(--border-medium);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
}

.manual-self-check-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 18px 22px 20px;
}

.manual-self-check-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 52px;
  padding: 12px 14px;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  background: var(--bg-secondary);
}

.manual-self-check-status strong {
  flex: 0 0 auto;
  font-size: 18px;
}

.manual-self-check-status span {
  min-width: 0;
  color: var(--text-secondary);
  font-size: 14px;
  text-align: right;
  word-break: break-word;
}

.manual-self-check-status.success {
  border-color: rgba(45, 106, 79, 0.36);
  background: rgba(45, 106, 79, 0.08);
}

.manual-self-check-status.warning {
  border-color: rgba(230, 160, 23, 0.36);
  background: rgba(230, 160, 23, 0.1);
}

.manual-self-check-status.danger {
  border-color: rgba(220, 53, 69, 0.34);
  background: rgba(220, 53, 69, 0.08);
}

.manual-self-check-status.info {
  border-color: rgba(74, 144, 226, 0.34);
  background: rgba(74, 144, 226, 0.08);
}

.manual-self-check-meta {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.manual-self-check-meta div {
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  background: var(--bg-secondary);
}

.manual-self-check-meta span {
  display: block;
  color: var(--text-muted);
  font-size: 13px;
}

.manual-self-check-meta strong {
  display: block;
  margin-top: 5px;
  color: var(--text-primary);
  font-size: 15px;
  word-break: break-word;
}

.manual-self-check-table-wrap {
  margin-top: 16px;
  overflow: auto;
  border: 1px solid var(--border-light);
  border-radius: 8px;
}

.manual-self-check-table {
  width: 100%;
  min-width: 720px;
  border-collapse: collapse;
  font-size: 14px;
}

.manual-self-check-table th,
.manual-self-check-table td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-light);
  text-align: left;
  vertical-align: middle;
}

.manual-self-check-table th {
  position: sticky;
  top: 0;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-weight: 800;
  z-index: 1;
}

.manual-self-check-table tr:last-child td {
  border-bottom: 0;
}

.manual-self-check-table td:first-child strong,
.manual-self-check-table td:first-child span {
  display: block;
}

.manual-self-check-table td:first-child span {
  margin-top: 3px;
  color: var(--text-muted);
  font-size: 12px;
}

.manual-self-check-table tr.success td:nth-child(2) {
  color: var(--success);
  font-weight: 800;
}

.manual-self-check-table tr.warning td:nth-child(2) {
  color: var(--warning);
  font-weight: 800;
}

.manual-self-check-table tr.danger td:nth-child(2) {
  color: var(--danger);
  font-weight: 800;
}

.manual-self-check-empty {
  height: 92px;
  color: var(--text-muted);
  text-align: center !important;
}

.manual-self-check-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 22px 20px;
  border-top: 1px solid var(--border-light);
}

.manual-self-check-secondary,
.manual-self-check-primary {
  min-width: 92px;
  min-height: 40px;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
}

.manual-self-check-secondary {
  border: 1px solid var(--border-medium);
  background: var(--bg-card);
  color: var(--text-secondary);
}

.manual-self-check-primary {
  border: 1px solid var(--primary);
  background: var(--primary);
  color: var(--text-inverse);
}

.manual-self-check-primary:disabled {
  opacity: 0.62;
  cursor: not-allowed;
}

.io-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 14px;
}

.io-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  min-height: 72px;
  padding: 12px 14px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  color: var(--text-secondary);
  box-shadow: var(--shadow-sm);
  transition: var(--transition);
  position: relative;
  overflow: hidden;
  cursor: pointer;
}

.io-item::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 4px;
}

.io-item.active {
  border-color: rgba(45, 106, 79, 0.35);
  background: linear-gradient(135deg, var(--bg-card), rgba(45, 106, 79, 0.08));
}

.io-item.inactive {
  border-color: rgba(220, 53, 69, 0.24);
  background: linear-gradient(135deg, var(--bg-card), rgba(220, 53, 69, 0.05));
}

.io-item.active::before {
  background: var(--success);
}

.io-item.inactive::before {
  background: var(--danger);
}

.io-item:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.io-item:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 3px;
}

.io-light {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 0 3px rgba(173, 181, 189, 0.12);
}

.io-item.active .io-light {
  background: var(--success);
  box-shadow: 0 0 0 4px rgba(45, 106, 79, 0.13), 0 0 10px rgba(45, 106, 79, 0.35);
}

.io-item.inactive .io-light {
  background: var(--danger);
  box-shadow: 0 0 0 4px rgba(220, 53, 69, 0.1);
}

.io-content {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.io-address {
  color: var(--text-primary);
  font-family: 'SF Mono', 'JetBrains Mono', monospace;
  font-size: 16px;
  line-height: 1;
}

.io-name {
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.io-state {
  flex-shrink: 0;
  min-width: 34px;
  padding: 3px 6px;
  border-radius: 10px;
  font-family: 'SF Mono', 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  text-align: center;
}

.io-item.active .io-state {
  color: var(--success);
  background: rgba(45, 106, 79, 0.12);
}

.io-item.inactive .io-state {
  color: var(--danger);
  background: rgba(220, 53, 69, 0.1);
}

@media (max-width: 1400px) {
  .io-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .io-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .digital-tower {
    padding: 16px;
  }
  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  .section-actions {
    width: 100%;
    justify-content: space-between;
  }
  .section-stats {
    flex-wrap: wrap;
    gap: 12px;
  }
  .section-title h2 {
    font-size: 22px;
  }
  .io-grid {
    grid-template-columns: 1fr;
  }
}
</style>
