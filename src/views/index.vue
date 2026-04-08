<template>
  <div class="digital-tower">
    <!-- 背景装饰 -->
    <div class="bg-decoration">
      <div class="grid-lines"></div>
      <div class="radar-scan"></div>
    </div>

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
          <span class="line-icon"></span>
          <h2>{{ lineName }}</h2>
          <span class="line-count">{{ lineDetectors.length }}台设备</span>
        </div>
        <div class="line-stats">
          <span class="online">在线: {{ getLineOnlineCount(lineDetectors) }}</span>
          <span class="warning">警告: {{ getLineWarningCount(lineDetectors) }}</span>
          <span class="danger">危险: {{ getLineDangerCount(lineDetectors) }}</span>
          <span class="avg">均值: {{ getLineAvgValue(lineDetectors).toFixed(1) }}</span>
        </div>
      </div>

      <!-- 检测器网格 -->
      <DetectorGrid
          :detectors="lineDetectors"
          :threshold="THRESHOLD"
          @open-detail="openDetail"
      />
    </div>

    <!-- 底部：报警栏 -->
    <AlarmBar :alarms="latestAlarms" @clear="clearAllAlarms" />

    <!-- 详情弹窗 -->
    <div v-if="selectedDetector" class="modal-overlay" @click="closeDetail">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ selectedDetector.name }} 详细数据</h3>
          <button class="close-btn" @click="closeDetail">×</button>
        </div>
        <div class="modal-body">
          <div class="detail-value">
            <div class="current-value">
              <span class="label">设备状态</span>
              <span class="value" :class="getDetailStatusClass(selectedDetector)">
                {{ selectedDetector.status || 'UNKNOWN' }}
              </span>
            </div>
            <div class="stats-row">
              <div><span>设备IP</span><strong>{{ selectedDetector.device }}</strong></div>
              <div><span>产线</span><strong>{{ selectedDetector.lineName }}</strong></div>
              <div><span>工位</span><strong>{{ selectedDetector.stationName }}</strong></div>
              <div><span>最后心跳</span><strong>{{ selectedDetector.lastHeartbeat || '--' }}</strong></div>
            </div>
          </div>

          <!-- 关键参数区域 -->
          <div class="detail-params" v-if="selectedDetector.lastTriggerIndex !== undefined || selectedDetector.lastTotalTime !== undefined">
            <div class="params-title">关键参数</div>
            <div class="params-grid">
              <div class="param-card" v-if="selectedDetector.lastTriggerIndex !== undefined">
                <div class="param-label">触发次数</div>
                <div class="param-value">{{ selectedDetector.lastTriggerIndex || 0 }}</div>
                <div class="param-unit">次</div>
              </div>
              <div class="param-card" v-if="selectedDetector.lastTotalTime !== undefined">
                <div class="param-label">累计时间</div>
                <div class="param-value">{{ selectedDetector.lastTotalTime || 0 }}</div>
                <div class="param-unit">秒</div>
              </div>
              <div class="param-card" v-if="selectedDetector.lastCode">
                <div class="param-label">最新码</div>
                <div class="param-value small">{{ selectedDetector.lastCode }}</div>
              </div>
            </div>
          </div>

          <div class="detail-alarms">
            <h4>报警记录</h4>
            <div class="alarm-list">
              <div v-for="alarm in selectedDetector.alarms.slice(0, 5)" :key="alarm.id" class="alarm-item" :class="alarm.level">
                <span class="time">{{ alarm.time }}</span>
                <span class="msg">{{ alarm.message }}</span>
              </div>
              <div v-if="selectedDetector.alarms.length === 0" class="empty">暂无报警</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import signalRService from '../utils/signal.ts'
import type { ConnectionStatus } from '../types/detection'
import HeaderSection from '../components/HeaderSection.vue'
import DetectorGrid from '../components/DetectorGrid.vue'
import AlarmBar from '../components/AlarmBar.vue'

// ==================== 配置 ====================
const THRESHOLD = { warning: 70, danger: 90 }
const HUB_URL = import.meta.env.VITE_SIGNALR_HUB_URL || '/hubs/device'
const MAX_TREND_POINTS = 30
const THROTTLE_MS = 100

// ==================== 状态配置 ====================
// 状态映射
const STATUS_CONFIG = {
  OK: { text: '正常', type: 'online', color: '#00ff88', level: 'normal' },
  NO_READ: { text: '心跳异常', type: 'offline', color: '#ffaa00', level: 'warning' },
  OFFLINE: { text: '离线', type: 'offline', color: '#666', level: 'offline' }
}

// 判断设备是否在线（用于统计）
const isDeviceOnline = (status: string): boolean => {
  return status === 'OK'
}

// 获取设备状态文本
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
const detailCanvas = ref<HTMLCanvasElement | null>(null)

// ==================== 计算属性：按产线分组 ====================
const groupedDetectors = computed(() => {
  const groups: Record<string, any[]> = {}
  detectors.value.forEach(detector => {
    const lineName = detector.lineName || '未分组'
    if (!groups[lineName]) {
      groups[lineName] = []
    }
    groups[lineName].push(detector)
  })
  return groups
})

// 产线统计函数
const getLineOnlineCount = (lineDetectors: any[]) => {
  return lineDetectors.filter(d => d.isConnected).length
}

const getLineWarningCount = (lineDetectors: any[]) => {
  return lineDetectors.filter(d => d.displayValue >= THRESHOLD.warning && d.displayValue < THRESHOLD.danger).length
}

const getLineDangerCount = (lineDetectors: any[]) => {
  return lineDetectors.filter(d => d.displayValue >= THRESHOLD.danger).length
}

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

// 更新检测器列表
const updateDetectorsFromData = (devices: any[]) => {
  if (!devices || !devices.length) return

  devices.forEach((device: any) => {
    const deviceId = device.device
    const existingDetector = detectors.value.find(d => d.id === deviceId)
    const now = Date.now()
    const value = device.lastTotalTime || 0
    const status = device.status || 'OFFLINE'
    const isOnline = isDeviceOnline(status)  // ✅ 只有 OK 才算在线

    if (existingDetector) {
      // 更新现有检测器
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
        existingDetector.lastUpdateTime = new Date().toLocaleTimeString()

        if (existingDetector.lastValue !== 0) {
          existingDetector.trend = value - existingDetector.lastValue
          existingDetector.changeRate = ((value - existingDetector.lastValue) / Math.abs(existingDetector.lastValue)) * 100
        }
        existingDetector.lastValue = value
      }

      // ✅ 根据状态设置连接状态（只有 OK 才算在线）
      existingDetector.isConnected = isOnline
      existingDetector.valueBuffer.push(value)

      if (value > existingDetector.maxValue) existingDetector.maxValue = value
      if (value < existingDetector.minValue) existingDetector.minValue = value

      existingDetector.trendData.push(value)
      if (existingDetector.trendData.length > MAX_TREND_POINTS) {
        existingDetector.trendData.shift()
      }

      // ✅ 检查报警（状态变化时报警）
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

    } else {
      // 新增检测器
      detectors.value.push({
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
        alarms: [],
        trendData: [value],
        valueBuffer: [value],
        lastRenderTime: now
      })
    }
  })
}

// 更新统计信息
const updateStatistics = () => {
  detectors.value.forEach(detector => {
    if (detector.valueBuffer.length > 0) {
      const sum = detector.valueBuffer.reduce((a: any, b: any) => a + b, 0)
      detector.avgValue = sum / detector.valueBuffer.length
      detector.valueBuffer = []
    }
  })
}

// 报警
const addAlarm = (detectorId: string, level: string, message: string, value: number) => {
  const detector = detectors.value.find(d => d.id === detectorId)
  if (!detector) return

  const lastAlarm = detector.alarms[0]
  if (lastAlarm && (Date.now() - lastAlarm.timestamp) < 30000 && lastAlarm.message === message) {
    return
  }

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

// 处理检测记录数据（records）
const updateRecordsFromData = (records: any[]) => {
  if (!records || !records.length) return

  records.forEach((record: any) => {
    let deviceId = record.device
    if (deviceId && deviceId.includes(':')) {
      deviceId = deviceId.split(':')[0]
    }

    const existingDetector = detectors.value.find(d => d.id === deviceId)

    if (existingDetector) {
      const now = Date.now()
      const value = record.totalTime || 0
      const status = record.status || 'OK'
      const isOnline = isDeviceOnline(status)  // ✅ 只有 OK 才算在线

      // 更新关键参数
      existingDetector.lastTriggerIndex = record.triggerIndex
      existingDetector.lastTotalTime = record.totalTime
      existingDetector.lastCode = record.code
      existingDetector.status = status
      existingDetector.statusText = getDeviceStatusText(status)
      existingDetector.stationName = record.stationName || existingDetector.stationName

      // 每次都更新显示数值
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
      if (existingDetector.trendData.length > MAX_TREND_POINTS) {
        existingDetector.trendData.shift()
      }

      // ✅ 更新连接状态
      const previousOnline = existingDetector.isConnected
      existingDetector.isConnected = isOnline

      // 状态变化报警
      if (isOnline !== previousOnline) {
        if (!isOnline) {
          const alarmMsg = status === 'NO_READ' ? '心跳异常' : '离线'
          addAlarm(deviceId, status === 'NO_READ' ? 'warning' : 'danger', `设备 ${existingDetector.name} ${alarmMsg}`, value)
        } else {
          addAlarm(deviceId, 'warning', `设备 ${existingDetector.name} 恢复在线`, value)
        }
        existingDetector.wasOnline = isOnline
      }

    } else {
      // 新增检测器
      console.log('发现新设备:', deviceId)
      const now = Date.now()
      const value = record.totalTime || 0
      const status = record.status || 'OK'
      const isOnline = isDeviceOnline(status)

      detectors.value.push({
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
        alarms: [],
        trendData: [value],
        valueBuffer: [value],
        lastRenderTime: now
      })
    }
  })
}

// 处理报警数据（alarms）
const updateAlarmsFromData = (alarms: any[]) => {
  if (!alarms || !alarms.length) return

  alarms.forEach((alarm: any) => {
    let deviceId = alarm.device
    if (deviceId && deviceId.includes(':')) {
      deviceId = deviceId.split(':')[0]
    }

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

    console.log(`报警: ${alarm.alarmType} - ${alarm.message}`)
  })
}

// ==================== SignalR 数据处理 ====================
const handleDetectionData = (data: any) => {
  console.log('收到 SignalR 数据:', data)

  try {
    if (data.type !== undefined && data.target && data.arguments) {
      const target = data.target
      const args = data.arguments[0]

      switch (target) {
        case 'devices':
          if (Array.isArray(args)) {
            console.log('收到设备状态数据，数量:', args.length)
            updateDetectorsFromData(args)
          }
          break
        case 'records':
          if (Array.isArray(args)) {
            console.log('收到检测记录数据，数量:', args.length)
            updateRecordsFromData(args)
          }
          break
        case 'alarms':
          if (Array.isArray(args)) {
            console.log('收到报警数据，数量:', args.length)
            updateAlarmsFromData(args)
          }
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

// 连接状态变化处理
const handleStatusChange = (status: ConnectionStatus) => {
  console.log('SignalR 连接状态:', status)
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

// 初始化 SignalR 连接
const initSignalR = async () => {
  try {
    signalRService.buildConnection(HUB_URL, {})

    // 监听三个不同的事件
    signalRService.on('devices', handleDetectionData)
    // signalRService.on('records', handleDetectionData)
    // signalRService.on('alarms', handleDetectionData)

    signalRService.onStatusChange(handleStatusChange)

    await signalRService.start()
    console.log('SignalR 连接成功，已监听 devices, records, alarms 事件')
  } catch (e) {
    console.error('SignalR 连接失败:', e)
  }
}

// 弹窗
const openDetail = (detector: any) => {
  selectedDetector.value = detector
  setTimeout(() => {
    if (detailCanvas.value && detector.trendData.length) {
      const canvas = detailCanvas.value
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (detector.trendData.length < 2) return

      const stepX = canvas.width / MAX_TREND_POINTS
      const startX = canvas.width - (detector.trendData.length * stepX)

      ctx.beginPath()
      if (detector.status === 'DANGER') ctx.strokeStyle = '#ff4444'
      else if (detector.status === 'WARNING') ctx.strokeStyle = '#ffaa00'
      else if (detector.status === 'ONLINE') ctx.strokeStyle = '#00ff88'
      else ctx.strokeStyle = '#666'
      ctx.lineWidth = 2

      detector.trendData.forEach((val: number, i: number) => {
        const x = startX + i * stepX
        const y = canvas.height - (Math.min(Math.max(val, 0), 100) / 100) * canvas.height
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
    }
  }, 50)
}

const closeDetail = () => { selectedDetector.value = null }

const getDetailStatusClass = (d: any) => {
  if (d.status === 'DANGER') return 'danger'
  if (d.status === 'WARNING') return 'warning'
  if (d.status === 'ONLINE') return 'normal'
  return 'offline'
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
  signalRService.off('records', handleDetectionData)
  signalRService.off('alarms', handleDetectionData)
  signalRService.stop()
})
</script>

<style scoped>
.digital-tower {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  background: radial-gradient(ellipse at 20% 30%, #0a0f1a, #05080f);
  padding: 24px 36px;
  font-family: 'Poppins', 'Segoe UI', monospace;
  color: #e0e0e0;
  overflow-y: auto;
  box-sizing: border-box;
  font-size: 16px;
}

.digital-tower::-webkit-scrollbar { width: 8px; background: rgba(0,0,0,0.3); }
.digital-tower::-webkit-scrollbar-thumb { background: #00ff88; border-radius: 4px; }

/* 背景装饰 */
.bg-decoration { position: fixed; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 0; }
.grid-lines {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background-image: linear-gradient(rgba(0,255,136,0.05) 1px, transparent 1px),
  linear-gradient(90deg, rgba(0,255,136,0.05) 1px, transparent 1px);
  background-size: 40px 40px;
}
.radar-scan {
  position: absolute; top: 20%; right: 5%; width: 300px; height: 300px; border-radius: 50%;
  background: radial-gradient(circle, rgba(0,255,136,0.03) 0%, transparent 70%);
  animation: radarRotate 20s linear infinite;
}
@keyframes radarRotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* 产线分区 */
.line-section {
  margin-bottom: 48px;
}

.line-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding: 0 8px;
}

.line-title {
  display: flex;
  align-items: center;
  gap: 14px;
}

.line-icon {
  width: 5px;
  height: 28px;
  background: linear-gradient(180deg, #00ff88, #00aa55);
  border-radius: 3px;
}

.line-title h2 {
  font-size: 26px;
  font-weight: 600;
  margin: 0;
  color: #fff;
}

.line-count {
  font-size: 15px;
  color: #88aabb;
  background: rgba(0,255,136,0.1);
  padding: 4px 10px;
  border-radius: 24px;
}

.line-stats {
  display: flex;
  gap: 20px;
  font-size: 15px;
}

.line-stats .online { color: #00ff88; }
.line-stats .warning { color: #ffaa00; }
.line-stats .danger { color: #ff4444; }
.line-stats .avg { color: #88aabb; }

/* 弹窗内关键参数 */
.detail-params {
  margin-bottom: 28px;
  padding: 20px;
  background: rgba(0,0,0,0.3);
  border-radius: 20px;
}
.params-title {
  font-size: 18px;
  color: #00ff88;
  margin-bottom: 20px;
  padding-left: 10px;
  border-left: 3px solid #00ff88;
}
.params-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}
.param-card {
  text-align: center;
  padding: 16px;
  background: rgba(0,0,0,0.3);
  border-radius: 16px;
}
.param-label {
  font-size: 14px;
  color: #88aabb;
  margin-bottom: 10px;
}
.param-value {
  font-size: 34px;
  font-weight: bold;
  font-family: monospace;
  color: #fff;
}
.param-value.small {
  font-size: 16px;
  word-break: break-all;
}
.param-unit {
  font-size: 13px;
  color: #88aabb;
  margin-top: 6px;
}

/* 弹窗其他样式 */
.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.8); backdrop-filter: blur(8px);
  display: flex; justify-content: center; align-items: center; z-index: 1000;
}
.modal-content {
  background: linear-gradient(135deg, #1a2a2a, #0f1a1a);
  border-radius: 28px; width: 90%; max-width: 800px; max-height: 80vh;
  border: 1px solid rgba(0,255,136,0.3); overflow-y: auto;
}
.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 24px 28px; border-bottom: 1px solid rgba(0,255,136,0.2);
}
.modal-header h3 { margin: 0; color: #00ff88; font-size: 24px; }
.close-btn { background: none; border: none; font-size: 34px; cursor: pointer; color: #88aabb; }
.close-btn:hover { color: #ff4444; }
.modal-body { padding: 28px; }
.detail-value { text-align: center; margin-bottom: 28px; }
.current-value .label { font-size: 18px; color: #88aabb; margin-right: 20px; }
.current-value .value { font-size: 44px; font-weight: bold; font-family: monospace; }
.current-value .value.normal { color: #00ff88; text-shadow: 0 0 10px rgba(0,255,136,0.5); }
.current-value .value.warning { color: #ffaa00; text-shadow: 0 0 10px rgba(255,170,0,0.5); }
.current-value .value.danger { color: #ff4444; text-shadow: 0 0 10px rgba(255,68,68,0.5); }
.current-value .value.offline { color: #666; }
.stats-row {
  display: flex; justify-content: space-around; margin-top: 20px; gap: 20px;
}
.stats-row div { text-align: center; }
.stats-row span { display: block; font-size: 14px; color: #88aabb; margin-bottom: 6px; }
.stats-row strong { font-size: 18px; color: #fff; }
.detail-alarms h4 { margin: 0 0 16px 0; color: #ffaa00; font-size: 20px; }
.alarm-list { max-height: 180px; overflow-y: auto; }
.alarm-item { padding: 12px 16px; border-radius: 10px; margin-bottom: 8px; font-size: 16px; }
.alarm-item.warning { background: rgba(255,170,0,0.1); border-left: 4px solid #ffaa00; }
.alarm-item.danger { background: rgba(255,68,68,0.1); border-left: 4px solid #ff4444; }
.alarm-item .time { font-family: monospace; margin-right: 16px; color: #88aabb; font-size: 14px; }
.empty { text-align: center; padding: 24px; color: #666; font-size: 16px; }

@media (max-width: 768px) {
  .digital-tower { padding: 16px; }
  .stats-row { flex-wrap: wrap; }
  .current-value .value { font-size: 36px; }
  .line-header { flex-direction: column; align-items: flex-start; gap: 14px; }
  .params-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>