<template>
  <div class="digital-tower">
    <!-- 顶部：标题栏 + KPI 卡片 -->
    <HeaderSection
        :current-time="currentTime"
        :current-date="currentDate"
        :detectors="detectors"
        :threshold="THRESHOLD"
    />

    <!-- 工控机状态卡片 -->
    <IpcStatus />

    <!-- 所有读码器网格 -->
    <div class="all-detectors-section">
      <div class="section-header">
        <div class="section-title">
          <span class="section-indicator"></span>
          <h2>所有读码器</h2>
          <span class="section-badge">{{ detectors.length }}台</span>
        </div>
        <div class="section-stats">
          <span class="stat-online">● 在线 {{ getTotalOnlineCount() }}</span>
          <span class="stat-warning">● 警告 {{ getTotalWarningCount() }}</span>
          <span class="stat-danger">● 危险 {{ getTotalDangerCount() }}</span>
          <span class="stat-avg">均值 {{ getTotalAvgValue().toFixed(1) }}</span>
        </div>
      </div>

      <DetectorGrid
          :detectors="detectors"
          :threshold="THRESHOLD"
          @open-detail="openDetail"
          @config-threshold="openThresholdConfig"
      />
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import HeaderSection from '../components/HeaderSection.vue'
import DetectorGrid from '../components/DetectorGrid.vue'
import AlarmBar from '../components/AlarmBar.vue'
import DetailModal from '../components/DetailModal.vue'
import IpcStatus from '../components/IpcStatus.vue'
import ThresholdConfig from '../components/ThresholdConfig.vue'
import type { ThresholdConfig as ThresholdConfigType } from '../components/ThresholdConfig.vue'
import { alarmApi } from '@/api/alarm'
import { readerApi } from '@/api/reader'
import type { Alarm } from '@/types/alarm'
import type { ReaderStatus } from '@/types/reader'
import type {Detector} from "@/types/detection.ts";

// ==================== 配置 ====================
const THRESHOLD = { warning: 70, danger: 90 }
const MAX_TREND_POINTS = 30

// ==================== 响应式数据 ====================
const currentTime = ref('')
const currentDate = ref('')
const detectors = ref<any[]>([])
const selectedDetector = ref<any>(null)
const latestAlarms = ref<any[]>([])
const thresholdConfigVisible = ref(false)
const configTargetDetector = ref<any>(null)

// ==================== 将 API 读码器数据转换为组件格式 ====================
// 将 API 读码器数据转换为组件格式（传递全部字段）
const convertReaderToDetector = (reader: ReaderStatus): Detector => {
  const isOnline = reader.tcpConnected && reader.pingOk
  let statusText = '离线'
  if (isOnline) {
    statusText = '正常'
  } else if (!reader.tcpConnected && reader.pingOk) {
    statusText = 'TCP断开'
  } else if (!reader.pingOk) {
    statusText = 'Ping失败'
  }

  const displayValue = reader.lastValidCodeIntervalMs || 0

  return {
    // 基础信息
    id: reader.readerId,
    name: reader.name || reader.readerId,
    device: reader.readerId,
    lineName: '产线一',
    stationName: reader.name,

    // 状态信息
    status: isOnline ? 'OK' : 'OFFLINE',
    statusText: statusText,
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
    temperature: reader.currentTemperature || 0,
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
    lastTriggerIndex: reader.recentIntervalCount || 0,
    lastTotalTime: reader.lastValidCodeIntervalMs || 0,
    recentIntervalCount: reader.recentIntervalCount,
    lastValidCodeIntervalMs: reader.lastValidCodeIntervalMs,
    recentAverageValidCodeIntervalMs: reader.recentAverageValidCodeIntervalMs,

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
    status_code: reader.status,

    // 告警和趋势数据
    alarms: [],
    trendData: [displayValue],
    valueBuffer: [displayValue],
    lastRenderTime: Date.now(),

    // 原始数据
    rawReader: reader
  }
}

// 从 API 获取所有读码器状态
const fetchReadersStatus = async () => {
  try {
    const readers = await readerApi.getReadersStatus()
    if (readers && readers.length > 0) {
      const newDetectors = readers.map(convertReaderToDetector)

      // 保留原有的自定义阈值和告警历史
      newDetectors.forEach(newDetector => {
        const oldDetector = detectors.value.find(d => d.id === newDetector.id)
        if (oldDetector) {
          // 使用类型断言或可选链
          newDetector.customThreshold = oldDetector.customThreshold
          newDetector.customTempThreshold = oldDetector.customTempThreshold
          newDetector.alarms = oldDetector.alarms || []
          newDetector.trendData = oldDetector.trendData || [newDetector.displayValue]
          newDetector.valueBuffer = oldDetector.valueBuffer || []

          // 更新趋势数据
          if (newDetector.trendData.length > MAX_TREND_POINTS) {
            newDetector.trendData.shift()
          }
          newDetector.trendData.push(newDetector.displayValue)

          // 计算趋势
          const lastValue = oldDetector.lastValue || newDetector.displayValue
          newDetector.trend = newDetector.displayValue - lastValue
          if (lastValue !== 0) {
            newDetector.changeRate = (newDetector.trend / Math.abs(lastValue)) * 100
          }
          newDetector.lastValue = newDetector.displayValue

          // 更新最大最小值
          newDetector.maxValue = Math.max(newDetector.displayValue, oldDetector.maxValue || newDetector.displayValue)
          newDetector.minValue = Math.min(newDetector.displayValue, oldDetector.minValue || newDetector.displayValue)

          // 计算平均值
          const allValues = [...(oldDetector.valueBuffer || []), newDetector.displayValue]
          if (allValues.length > 0) {
            newDetector.avgValue = allValues.reduce((a, b) => a + b, 0) / allValues.length
          }
        }
      })

      detectors.value = newDetectors
    }
  } catch (error) {
    console.error('获取读码器状态失败:', error)
  }
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

// 从 API 获取活跃告警
const fetchActiveAlarms = async () => {
  try {
    const alarms = await alarmApi.getActiveAlarms()
    if (alarms && alarms.length > 0) {
      latestAlarms.value = alarms.map(convertApiAlarmToComponentFormat)
    } else {
      latestAlarms.value = []
    }
  } catch (error) {
    console.error('获取活跃告警失败:', error)
  }
}

// 定时刷新读码器状态
let readersRefreshInterval: any
const startReadersRefresh = () => {
  readersRefreshInterval = setInterval(fetchReadersStatus, 3000) // 每3秒刷新一次
}

// 定时刷新告警
let alarmRefreshInterval: any
const startAlarmRefresh = () => {
  alarmRefreshInterval = setInterval(fetchActiveAlarms, 5000)
}

const clearAllAlarms = () => {
  latestAlarms.value = []
}

// ==================== 计算属性 - 所有读码器统计 ====================
const getTotalOnlineCount = () => {
  return detectors.value.filter(d => d.isConnected).length
}

const getTotalWarningCount = () => {
  return detectors.value.filter(d => {
    const threshold = d.customThreshold || THRESHOLD
    return d.displayValue >= threshold.warning && d.displayValue < threshold.danger
  }).length
}

const getTotalDangerCount = () => {
  return detectors.value.filter(d => {
    const threshold = d.customThreshold || THRESHOLD
    return d.displayValue >= threshold.danger
  }).length
}

const getTotalAvgValue = () => {
  if (detectors.value.length === 0) return 0
  const sum = detectors.value.reduce((s, d) => s + d.displayValue, 0)
  return sum / detectors.value.length
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
const openDetail = (detector: any) => { selectedDetector.value = detector }
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
    detector.customThreshold = {
      warning: config.warning,
      danger: config.danger
    }
    detector.customTempThreshold = {
      warning: config.tempWarning,
      danger: config.tempDanger
    }

    const allConfigs = JSON.parse(localStorage.getItem('device_thresholds') || '{}')
    allConfigs[detectorId] = config
    localStorage.setItem('device_thresholds', JSON.stringify(allConfigs))
  }
}

const loadThresholdFromLocal = (detector: any) => {
  const allConfigs = JSON.parse(localStorage.getItem('device_thresholds') || '{}')
  const saved = allConfigs[detector.id]
  if (saved) {
    detector.customThreshold = {
      warning: saved.warning,
      danger: saved.danger
    }
    detector.customTempThreshold = {
      warning: saved.tempWarning,
      danger: saved.tempDanger
    }
  }
}

// 为现有 detectors 加载阈值
const loadAllThresholds = () => {
  detectors.value.forEach(detector => {
    loadThresholdFromLocal(detector)
  })
}

// ==================== 生命周期 ====================
let statsInterval: any

onMounted(async () => {
  formatTime()
  setInterval(formatTime, 1000)

  // 初始化：获取读码器状态和告警
  await fetchReadersStatus()
  await fetchActiveAlarms()

  // 加载保存的阈值配置
  loadAllThresholds()

  // 启动定时刷新
  startReadersRefresh()
  startAlarmRefresh()
  statsInterval = setInterval(updateStatistics, 2000)
})

onUnmounted(() => {
  clearInterval(statsInterval)
  clearInterval(readersRefreshInterval)
  clearInterval(alarmRefreshInterval)
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

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 20px;
  padding: 0 4px;
}

.section-title {
  display: flex;
  align-items: baseline;
  gap: 12px;
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
  gap: 24px;
  font-size: 16px;
  font-weight: 500;
}

.section-stats span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.stat-online { color: var(--success); }
.stat-warning { color: var(--warning); }
.stat-danger { color: var(--danger); }
.stat-avg { color: var(--text-muted); }

@media (max-width: 768px) {
  .digital-tower {
    padding: 16px;
  }
  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  .section-stats {
    flex-wrap: wrap;
    gap: 12px;
  }
  .section-title h2 {
    font-size: 22px;
  }
}
</style>
