<!-- index.vue - 主页面优化 -->
<template>
  <div class="digital-tower">
    <!-- 顶部：标题栏 + KPI 卡片 -->
    <HeaderSection
        :current-time="currentTime"
        :current-date="currentDate"
        :detectors="detectors"
        :threshold="THRESHOLD"
    />

    <!-- 按产线分组显示 -->
    <div v-for="(lineDetectors, lineName) in groupedDetectors" :key="lineName" class="line-section">
      <div class="line-header">
        <div class="line-title">
          <span class="line-indicator"></span>
          <h2>{{ lineName }}</h2>
          <span class="line-badge">{{ lineDetectors.length }}台</span>
        </div>
        <div class="line-stats">
          <span class="stat-online">● 在线 {{ getLineOnlineCount(lineDetectors) }}</span>
          <span class="stat-warning">● 警告 {{ getLineWarningCount(lineDetectors) }}</span>
          <span class="stat-danger">● 危险 {{ getLineDangerCount(lineDetectors) }}</span>
          <span class="stat-avg">均值 {{ getLineAvgValue(lineDetectors).toFixed(1) }}</span>
        </div>
      </div>

      <DetectorGrid
          :detectors="lineDetectors"
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

    <!-- 在 DetailModal 后面添加 -->
    <ThresholdConfig
        :visible="thresholdConfigVisible"
        :detector="configTargetDetector"
        @close="closeThresholdConfig"
        @save="saveThresholdConfig"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import signalRService from '../utils/signal.ts'
import type { ConnectionStatus } from '../types/detection'
import HeaderSection from '../components/HeaderSection.vue'
import DetectorGrid from '../components/DetectorGrid.vue'
import AlarmBar from '../components/AlarmBar.vue'
import DetailModal from '../components/DetailModal.vue'
import ThresholdConfig from '../components/ThresholdConfig.vue'
import type { ThresholdConfig as ThresholdConfigType } from '../components/ThresholdConfig.vue'

// ==================== 配置 ====================
const THRESHOLD = { warning: 70, danger: 90 }
const HUB_URL = import.meta.env.VITE_SIGNALR_HUB_URL || '/hubs/device'
const MAX_TREND_POINTS = 30
const THROTTLE_MS = 100

// ==================== 状态映射 ====================
const STATUS_CONFIG = {
  OK: { text: '正常', type: 'online', color: '#00ff88', level: 'normal' },
  NO_READ: { text: '心跳异常', type: 'offline', color: '#ffaa00', level: 'warning' },
  OFFLINE: { text: '离线', type: 'offline', color: '#666', level: 'offline' }
}

const isDeviceOnline = (status: string): boolean => status === 'OK'

const getDeviceStatusText = (status: string): string => {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]
  return config?.text || status
}

// ==================== 响应式数据 ====================
const currentTime = ref('')
const currentDate = ref('')
const detectors = ref<any[]>([])
const selectedDetector = ref<any>(null)
const latestAlarms = ref<any[]>([])
// 阈值配置相关
const thresholdConfigVisible = ref(false)
const configTargetDetector = ref<any>(null)

// ==================== 计算属性 ====================
const groupedDetectors = computed(() => {
  const groups: Record<string, any[]> = {}
  detectors.value.forEach(detector => {
    const lineName = detector.lineName || '未分组'
    if (!groups[lineName]) groups[lineName] = []
    groups[lineName].push(detector)
  })
  return groups
})

const getLineOnlineCount = (lineDetectors: any[]) =>
    lineDetectors.filter(d => d.isConnected).length

const getLineWarningCount = (lineDetectors: any[]) =>
    lineDetectors.filter(d => {
      const threshold = d.customThreshold || THRESHOLD
      return d.displayValue >= threshold.warning && d.displayValue < threshold.danger
    }).length

const getLineDangerCount = (lineDetectors: any[]) =>
    lineDetectors.filter(d => {
      const threshold = d.customThreshold || THRESHOLD
      return d.displayValue >= threshold.danger
    }).length

const getLineAvgValue = (lineDetectors: any[]) => {
  if (lineDetectors.length === 0) return 0
  const sum = lineDetectors.reduce((s, d) => s + d.displayValue, 0)
  return sum / lineDetectors.length
}

// ==================== 辅助函数 ====================
const formatTime = () => {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString('zh-CN', { hour12: false })
  currentDate.value = now.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', weekday: 'short' })
}

const updateDetectorsFromData = (devices: any[]) => {
  if (!devices || !devices.length) return

  devices.forEach((device: any) => {
    const deviceId = device.device
    const existingDetector = detectors.value.find(d => d.id === deviceId)
    const now = Date.now()
    const value = device.lastTotalTime || 0
    const status = device.status || 'OFFLINE'
    const isOnline = isDeviceOnline(status)

    if (existingDetector) {
      if (now - existingDetector.lastRenderTime >= THROTTLE_MS) {
        existingDetector.lastRenderTime = now
        existingDetector.displayValue = value
        existingDetector.name = device.deviceName || device.device
        existingDetector.status = status
        existingDetector.statusText = getDeviceStatusText(status)
        existingDetector.lastHeartbeat = device.lastHeartbeat
        existingDetector.lineName = device.lineName || '未分组'
        existingDetector.stationName = device.stationName
        existingDetector.lastTriggerIndex = device.lastTriggerIndex || 0
        existingDetector.lastTotalTime = device.lastTotalTime || 0
        existingDetector.lastCode = device.lastCode || ''
        existingDetector.temperature = device.temperature || 0
        existingDetector.lastUpdateTime = new Date().toLocaleTimeString()

        if (existingDetector.lastValue !== 0) {
          existingDetector.trend = value - existingDetector.lastValue
          existingDetector.changeRate = ((value - existingDetector.lastValue) / Math.abs(existingDetector.lastValue)) * 100
        }
        existingDetector.lastValue = value
      }

      existingDetector.isConnected = isOnline
      existingDetector.valueBuffer.push(value)

      if (value > existingDetector.maxValue) existingDetector.maxValue = value
      if (value < existingDetector.minValue) existingDetector.minValue = value

      existingDetector.trendData.push(value)
      if (existingDetector.trendData.length > MAX_TREND_POINTS) existingDetector.trendData.shift()

      const previousOnline = existingDetector.wasOnline
      if (isOnline !== previousOnline) {
        if (!isOnline) {
          const alarmMsg = status === 'NO_READ' ? '心跳异常' : '离线'
          addAlarm(deviceId, status === 'NO_READ' ? 'warning' : 'danger', `设备 ${device.deviceName || device.device} ${alarmMsg}`, value)
        } else {
          addAlarm(deviceId, 'warning', `设备 ${device.deviceName || device.device} 恢复在线`, value)
        }
        existingDetector.wasOnline = isOnline
      }

      const currentTemp = device.temperature || 0
      const lastTempWarning = existingDetector.lastTempWarning || false
      if (currentTemp >= 60 && !lastTempWarning) {
        addAlarm(deviceId, 'danger', `设备 ${device.deviceName || device.device} 温度过高: ${currentTemp.toFixed(1)}°C`, value)
        existingDetector.lastTempWarning = true
      } else if (currentTemp < 60 && lastTempWarning) {
        existingDetector.lastTempWarning = false
      }
    } else {
      const newDetector = {
        id: deviceId,
        name: device.deviceName || device.device,
        device: device.device,
        lineName: device.lineName || '未分组',
        stationName: device.stationName,
        status: status,
        statusText: getDeviceStatusText(status),
        lastHeartbeat: device.lastHeartbeat,
        lastTriggerIndex: device.lastTriggerIndex || 0,
        lastTotalTime: device.lastTotalTime || 0,
        lastCode: device.lastCode || '',
        temperature: device.temperature || 0,
        displayValue: value,
        lastUpdateTime: new Date().toLocaleTimeString(),
        lastValue: value,
        trend: 0,
        changeRate: 0,
        maxValue: value,
        minValue: value,
        avgValue: value,
        isConnected: isOnline,
        wasOnline: isOnline,
        lastTempWarning: false,
        alarms: [],
        trendData: [value],
        valueBuffer: [value],
        lastRenderTime: now
      }
      loadThresholdFromLocal(newDetector)
      detectors.value.push(newDetector)
    }
  })
}

const updateStatistics = () => {
  detectors.value.forEach(detector => {
    if (detector.valueBuffer.length > 0) {
      const sum = detector.valueBuffer.reduce((a: any, b: any) => a + b, 0)
      detector.avgValue = sum / detector.valueBuffer.length
      detector.valueBuffer = []
    }
  })
}

const addAlarm = (detectorId: string, level: string, message: string, value: number) => {
  const detector = detectors.value.find(d => d.id === detectorId)
  if (!detector) return

  const lastAlarm = detector.alarms[0]
  if (lastAlarm && (Date.now() - lastAlarm.timestamp) < 30000 && lastAlarm.message === message) return

  const time = new Date().toLocaleTimeString()
  const alarm = {
    id: Date.now(),
    time,
    level,
    message,
    value,
    detectorName: detector.name,
    timestamp: Date.now()
  }
  detector.alarms.unshift(alarm)
  if (detector.alarms.length > 50) detector.alarms.pop()
  latestAlarms.value.unshift(alarm)
  if (latestAlarms.value.length > 10) latestAlarms.value.pop()
}

const clearAllAlarms = () => { latestAlarms.value = [] }

const updateRecordsFromData = (records: any[]) => {
  if (!records || !records.length) return

  records.forEach((record: any) => {
    let deviceId = record.device
    if (deviceId && deviceId.includes(':')) deviceId = deviceId.split(':')[0]

    const existingDetector = detectors.value.find(d => d.id === deviceId)

    if (existingDetector) {
      const now = Date.now()
      const value = record.totalTime || 0
      const status = record.status || 'OK'
      const isOnline = isDeviceOnline(status)

      existingDetector.lastTriggerIndex = record.triggerIndex
      existingDetector.lastTotalTime = record.totalTime
      existingDetector.lastCode = record.code
      existingDetector.status = status
      existingDetector.statusText = getDeviceStatusText(status)
      existingDetector.stationName = record.stationName || existingDetector.stationName
      existingDetector.temperature = record.temperature || existingDetector.temperature || 0
      existingDetector.displayValue = value

      if (now - existingDetector.lastRenderTime >= THROTTLE_MS) {
        existingDetector.lastRenderTime = now
        existingDetector.lastUpdateTime = new Date().toLocaleTimeString()

        if (existingDetector.lastValue !== 0) {
          existingDetector.trend = value - existingDetector.lastValue
          existingDetector.changeRate = ((value - existingDetector.lastValue) / Math.abs(existingDetector.lastValue)) * 100
        }
        existingDetector.lastValue = value
      }

      existingDetector.valueBuffer.push(value)

      if (value > existingDetector.maxValue) existingDetector.maxValue = value
      if (value < existingDetector.minValue) existingDetector.minValue = value

      existingDetector.trendData.push(value)
      if (existingDetector.trendData.length > MAX_TREND_POINTS) existingDetector.trendData.shift()

      const previousOnline = existingDetector.isConnected
      existingDetector.isConnected = isOnline

      if (isOnline !== previousOnline) {
        if (!isOnline) {
          const alarmMsg = status === 'NO_READ' ? '心跳异常' : '离线'
          addAlarm(deviceId, status === 'NO_READ' ? 'warning' : 'danger', `设备 ${existingDetector.name} ${alarmMsg}`, value)
        } else {
          addAlarm(deviceId, 'warning', `设备 ${existingDetector.name} 恢复在线`, value)
        }
        existingDetector.wasOnline = isOnline
      }

      const currentTemp = record.temperature || existingDetector.temperature || 0
      const lastTempWarning = existingDetector.lastTempWarning || false
      if (currentTemp >= 60 && !lastTempWarning) {
        addAlarm(deviceId, 'danger', `设备 ${existingDetector.name} 温度过高: ${currentTemp.toFixed(1)}°C`, value)
        existingDetector.lastTempWarning = true
      } else if (currentTemp < 60 && lastTempWarning) {
        existingDetector.lastTempWarning = false
      }
    } else {
      const now = Date.now()
      const value = record.totalTime || 0
      const status = record.status || 'OK'
      const isOnline = isDeviceOnline(status)

      const newDetector = {
        id: deviceId,
        name: record.deviceName || `设备 ${deviceId}`,
        device: deviceId,
        lineName: record.lineName || '未知',
        stationName: record.stationName || '未知',
        status: status,
        statusText: getDeviceStatusText(status),
        lastHeartbeat: record.createTime,
        lastTriggerIndex: record.triggerIndex,
        lastTotalTime: record.totalTime,
        lastCode: record.code,
        temperature: record.temperature || 0,
        displayValue: value,
        lastUpdateTime: new Date().toLocaleTimeString(),
        lastValue: value,
        trend: 0,
        changeRate: 0,
        maxValue: value,
        minValue: value,
        avgValue: value,
        isConnected: isOnline,
        wasOnline: isOnline,
        lastTempWarning: false,
        alarms: [],
        trendData: [value],
        valueBuffer: [value],
        lastRenderTime: now
      }
      loadThresholdFromLocal(newDetector)
      detectors.value.push(newDetector)
    }
  })
}

const updateAlarmsFromData = (alarms: any[]) => {
  if (!alarms || !alarms.length) return

  alarms.forEach((alarm: any) => {
    let deviceId = alarm.device
    if (deviceId && deviceId.includes(':')) deviceId = deviceId.split(':')[0]

    const detector = detectors.value.find(d => d.id === deviceId)
    const detectorName = detector?.name || alarm.device

    const time = new Date(alarm.createTime).toLocaleTimeString()
    const alarmItem = {
      id: Date.now(),
      time,
      level: 'danger' as const,
      message: `${alarm.alarmType}: ${alarm.message}`,
      value: 0,
      detectorName: detectorName,
      timestamp: Date.now()
    }

    latestAlarms.value.unshift(alarmItem)
    if (latestAlarms.value.length > 10) latestAlarms.value.pop()

    if (detector) {
      detector.alarms.unshift(alarmItem)
      if (detector.alarms.length > 50) detector.alarms.pop()
      detector.status = 'WARNING'
    }
  })
}

// ==================== SignalR 数据处理 ====================
const handleDetectionData = (data: any) => {
  try {
    if (data.type !== undefined && data.target && data.arguments) {
      const target = data.target
      const args = data.arguments[0]

      switch (target) {
        case 'devices':
          if (Array.isArray(args)) updateDetectorsFromData(args)
          break
        case 'records':
          if (Array.isArray(args)) updateRecordsFromData(args)
          break
        case 'alarms':
          if (Array.isArray(args)) updateAlarmsFromData(args)
          break
        default:
          console.log('未知的 target 类型:', target)
      }
    } else if (Array.isArray(data)) {
      updateDetectorsFromData(data)
    } else if (data.device) {
      updateDetectorsFromData([data])
    } else {
      console.warn('无法解析的数据格式:', data)
    }
  } catch (error) {
    console.error('解析数据失败:', error)
  }
}

const handleStatusChange = (status: ConnectionStatus) => {
  if (!status.isConnected) {
    detectors.value.forEach(d => {
      d.isConnected = false
      if (d.wasOnline !== false) {
        addAlarm(d.id, 'danger', `与设备 ${d.name} 连接断开`, 0)
        d.wasOnline = false
      }
    })
  }
}

const initSignalR = async () => {
  try {
    signalRService.buildConnection(HUB_URL, {})
    signalRService.on('devices', handleDetectionData)
    signalRService.onStatusChange(handleStatusChange)
    await signalRService.start()
    console.log('SignalR 连接成功')
  } catch (e) {
    console.error('SignalR 连接失败:', e)
  }
}

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
    // 保存自定义阈值
    detector.customThreshold = {
      warning: config.warning,
      danger: config.danger
    }
    detector.customTempThreshold = {
      warning: config.tempWarning,
      danger: config.tempDanger
    }

    // 保存到 localStorage
    const allConfigs = JSON.parse(localStorage.getItem('device_thresholds') || '{}')
    allConfigs[detectorId] = config
    localStorage.setItem('device_thresholds', JSON.stringify(allConfigs))
  }
}

// 加载保存的阈值配置
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

// 生命周期
let statsInterval: any
onMounted(async () => {
  formatTime()
  setInterval(formatTime, 1000)
  await initSignalR()
  statsInterval = setInterval(updateStatistics, 2000)
})

onUnmounted(() => {
  clearInterval(statsInterval)
  signalRService.off('devices', handleDetectionData)
  signalRService.stop()
})
</script>

<!-- index.vue - 添加全局主题变量 -->
<style>
/* ==================== 全局主题变量 ==================== */
/* 亮色模式（默认） */
:root {
  --bg-primary: #f5f7fa;
  --bg-secondary: #ffffff;
  --bg-tertiary: #e8ecef;
  --bg-card: #ffffff;
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

/* 暗色模式 */
.dark-theme {
  --bg-primary: #0f1419;
  --bg-secondary: #1a222a;
  --bg-tertiary: #1e252d;
  --bg-card: #1a222a;
  --text-primary: #e0e4e8;
  --text-secondary: #9aaebf;
  --text-muted: #6c7a8a;
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
  color: var(--text-primary);
  overflow-y: auto;
  box-sizing: border-box;
  font-size: 30px;
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

/* 产线分区 */
.line-section {
  margin-bottom: 40px;
}

.line-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 20px;
  padding: 0 4px;
}

.line-title {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.line-indicator {
  width: 4px;
  height: 22px;
  background: var(--success);
  border-radius: 2px;
}

.line-title h2 {
  font-size: 30px;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
  letter-spacing: -0.3px;
}

.line-badge {
  font-size: 20px;
  color: var(--text-muted);
  background: var(--bg-tertiary);
  padding: 2px 8px;
  border-radius: 20px;
}

.line-stats {
  display: flex;
  gap: 24px;
  font-size: 18px;
  font-weight: 500;
}

.line-stats span {
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
  .line-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  .line-stats {
    flex-wrap: wrap;
    gap: 12px;
  }
}
</style>