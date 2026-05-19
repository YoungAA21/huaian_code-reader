<template>
  <div v-if="detector" class="modal-overlay" @click="handleClose">
    <div class="modal-container" @click.stop>
      <div class="modal-header">
        <div class="header-info">
          <div class="device-title">{{ detector.name || detector.id }}</div>
          <div class="device-sub">{{ detector.ip || '--' }}</div>
        </div>
        <button class="close-button" @click="handleClose">×</button>
      </div>

      <div class="modal-body">
        <!-- 状态摘要 -->
        <div class="summary-section">
          <div class="status-badge" :class="getStatusClass">
            {{ getStatusText() }}
          </div>
          <div class="summary-stats">
            <div class="summary-item">
              <span class="summary-label">当前值</span>
              <strong class="summary-value" :class="getValueClass">{{ (detector.displayValue || 0).toFixed(0) }}ms</strong>
            </div>
            <div class="summary-item">
              <span class="summary-label">设备温度</span>
              <strong class="summary-value" :class="getTempClass">{{ (detector.temperature || 0).toFixed(1) }}°C</strong>
            </div>
          </div>
        </div>

        <!-- 基本信息网格 -->
        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">设备ID</span>
            <span class="info-value">{{ detector.id || '--' }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">设备IP</span>
            <span class="info-value">{{ detector.ip || '--' }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">产线</span>
            <span class="info-value">{{ detector.lineName || '--' }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">品牌</span>
            <span class="info-value">{{ detector.stationName || detector.name || '--' }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">TCP端口</span>
            <span class="info-value">{{ detector.tcpPort || '--' }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">TCP连接</span>
            <span class="info-value" :class="detector.tcpConnected ? 'success' : 'danger'">
              {{ detector.tcpConnected ? '已连接' : '未连接' }}
            </span>
          </div>
          <div class="info-row">
            <span class="info-label">Ping状态</span>
            <span class="info-value" :class="detector.pingOk ? 'success' : 'danger'">
              {{ detector.pingOk ? '正常' : '失败' }}
            </span>
          </div>
          <div class="info-row">
            <span class="info-label">Modbus状态</span>
            <span class="info-value" :class="detector.modbusOk ? 'success' : 'danger'">
              {{ detector.modbusOk ? '正常' : '异常' }}
            </span>
          </div>
          <div class="info-row">
            <span class="info-label">最后收码时间</span>
            <span class="info-value">{{ formatTime(detector.lastValidCodeTime || detector.lastReceiveTime) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">最后码值</span>
            <span class="info-value code">{{ detector.lastRawText || detector.lastCode || '--' }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">平均码间隔</span>
            <span class="info-value">{{ (detector.recentAverageValidCodeIntervalMs || 0).toFixed(0) }}ms</span>
          </div>
          <div class="info-row">
            <span class="info-label">触发次数</span>
            <span class="info-value">{{ detector.lastTriggerIndex || 0 }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">更新时间</span>
            <span class="info-value">{{ formatTime(detector.updatedTime) || detector.lastUpdateTime || '--' }}</span>
          </div>
        </div>

        <!-- 历史告警记录 -->
        <div class="alarms-section">
          <div class="section-title">
            <span class="title-mark"></span>
            <span>历史告警记录</span>
            <span v-if="historyTotal > 0" class="history-count">(共{{ historyTotal }}条)</span>
            <button
                v-if="historyTotal > historyAlarms.length"
                class="load-more-btn"
                @click="loadMoreHistory"
                :disabled="loadingHistory"
            >
              {{ loadingHistory ? '加载中...' : '加载更多' }}
            </button>
          </div>
          <div class="alarms-list" v-if="historyAlarms.length > 0">
            <div v-for="alarm in historyAlarms" :key="alarm.id" class="alarm-item" :class="getAlarmLevelClass(alarm.level)">
              <span class="alarm-time">{{ formatTime(alarm.startTime) }}</span>
              <span class="alarm-type">{{ getAlarmTypeText(alarm.type) }}</span>
              <span class="alarm-message">{{ alarm.message }}</span>
              <span class="alarm-status" :class="alarm.isRecovered ? 'recovered' : 'active'">
                {{ alarm.isRecovered ? '已恢复' : '未恢复' }}
              </span>
            </div>
          </div>
          <div v-else-if="loadingHistory" class="alarms-loading">
            <span class="loading-spinner"></span> 加载告警记录...
          </div>
          <div v-else class="alarms-empty">
            暂无告警记录
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { alarmApi } from '@/api/alarm'
import type { Alarm } from '@/types/alarm'

const props = defineProps<{ detector: any | null }>()
const emit = defineEmits<{ close: [] }>()

// 历史告警数据
const historyAlarms = ref<Alarm[]>([])
const historyTotal = ref(0)
const historyPage = ref(1)
const loadingHistory = ref(false)
const hasMore = ref(true)

// 获取设备的自定义温度阈值
const getTempThreshold = (detector: any) => {
  return detector.customTempThreshold || { warning: 45, danger: 60 }
}

// 获取设备的自定义耗时阈值
const getValueThreshold = (detector: any) => {
  return detector.customThreshold || { warning: 70, danger: 90 }
}

// 获取状态文本
const getStatusText = () => {
  if (!props.detector) return 'UNKNOWN'
  if (props.detector.isConnected) {
    const val = props.detector.displayValue
    const threshold = getValueThreshold(props.detector)
    if (val >= threshold.danger) return '危险'
    if (val >= threshold.warning) return '警告'
    return '正常'
  }
  return '离线'
}

// 获取状态样式类
const getStatusClass = computed(() => {
  if (!props.detector) return ''
  if (!props.detector.isConnected) return 'offline'
  const val = props.detector.displayValue
  const threshold = getValueThreshold(props.detector)
  if (val >= threshold.danger) return 'danger'
  if (val >= threshold.warning) return 'warning'
  return 'normal'
})

// 获取数值样式类
const getValueClass = computed(() => {
  if (!props.detector) return ''
  const val = props.detector.displayValue
  const threshold = getValueThreshold(props.detector)
  if (val >= threshold.danger) return 'danger'
  if (val >= threshold.warning) return 'warning'
  return ''
})

// 获取温度样式类
const getTempClass = computed(() => {
  if (!props.detector) return ''
  const temp = props.detector.temperature || 0
  const threshold = getTempThreshold(props.detector)
  if (temp >= threshold.danger) return 'danger'
  if (temp >= threshold.warning) return 'warning'
  return ''
})

// 获取告警级别样式类
const getAlarmLevelClass = (level: number) => {
  if (level >= 2) return 'danger'
  return 'warning'
}

// 获取告警类型文本
const getAlarmTypeText = (type: number) => {
  const typeMap: Record<number, string> = {
    1: '超时',
    7: 'Ping失败',
    9: '心跳丢失',
    10: 'TCP断开'
  }
  return typeMap[type] || `类型${type}`
}

// 加载历史告警
const loadHistoryAlarms = async (reset = true) => {
  if (!props.detector) return

  if (reset) {
    historyPage.value = 1
    historyAlarms.value = []
    hasMore.value = true
  }

  if (!hasMore.value && !reset) return

  loadingHistory.value = true

  try {
    const params = {
      readerId: props.detector.id,
      pageIndex: historyPage.value,
      pageSize: 10
    }

    const response = await alarmApi.getHistoryAlarms(params)
    historyTotal.value = response.total

    if (reset) {
      historyAlarms.value = response.items
    } else {
      historyAlarms.value = [...historyAlarms.value, ...response.items]
    }

    // 判断是否还有更多数据
    hasMore.value = historyAlarms.value.length < historyTotal.value

    if (response.items.length > 0) {
      historyPage.value++
    }
  } catch (error) {
    console.error('加载历史告警失败:', error)
  } finally {
    loadingHistory.value = false
  }
}

// 加载更多
const loadMoreHistory = () => {
  if (!loadingHistory.value && hasMore.value) {
    loadHistoryAlarms(false)
  }
}

// 关闭弹窗
const handleClose = () => {
  // 重置状态
  historyAlarms.value = []
  historyTotal.value = 0
  historyPage.value = 1
  hasMore.value = true
  emit('close')
}

// 格式化时间
const formatTime = (timeStr: string | undefined | null) => {
  if (!timeStr) return '--'

  try {
    let date: Date

    if (/^\d+$/.test(timeStr)) {
      const timestamp = parseInt(timeStr)
      date = timestamp > 9999999999 ? new Date(timestamp) : new Date(timestamp * 1000)
    } else {
      date = new Date(timeStr)
    }

    if (isNaN(date.getTime())) {
      return timeStr
    }

    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  } catch (error) {
    return timeStr
  }
}

// 监听 detector 变化，加载历史告警
watch(() => props.detector, (newDetector) => {
  if (newDetector) {
    loadHistoryAlarms()
  }
}, { immediate: true })
</script>

<style scoped>
:deep(*) {
  font-size: 16px !important;
}
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
  z-index: 1000;
}

.modal-container {
  background: var(--bg-card);
  border-radius: 16px;
  width: 90%;
  max-width: 650px;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
}

.modal-container::-webkit-scrollbar {
  width: 4px;
}
.modal-container::-webkit-scrollbar-track {
  background: var(--border-light);
  border-radius: 2px;
}
.modal-container::-webkit-scrollbar-thumb {
  background: var(--text-muted);
  border-radius: 2px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-light);
}

.header-info {
  flex: 1;
}

.device-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.device-sub {
  font-size: 16px;
  color: var(--text-muted);
  font-family: monospace;
}

.close-button {
  background: none;
  border: none;
  font-size: 36px;
  cursor: pointer;
  color: var(--text-muted);
  padding: 0;
  line-height: 1;
  transition: var(--transition);
}

.close-button:hover {
  color: var(--danger);
}

.modal-body {
  padding: 20px 24px;
}

.summary-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border-light);
}

.status-badge {
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 18px;
  font-weight: 600;
}

.status-badge.normal {
  background: rgba(45, 106, 79, 0.1);
  color: var(--success);
}
.status-badge.warning {
  background: rgba(230, 160, 23, 0.1);
  color: var(--warning);
}
.status-badge.danger {
  background: rgba(220, 53, 69, 0.1);
  color: var(--danger);
}
.status-badge.offline {
  background: rgba(173, 181, 189, 0.1);
  color: var(--border-heavy);
}

.summary-stats {
  display: flex;
  gap: 24px;
}

.summary-item {
  text-align: right;
}

.summary-label {
  display: block;
  font-size: 14px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.summary-value {
  font-size: 26px;
  font-weight: 700;
  font-family: monospace;
  color: var(--text-primary);
}

.summary-value.danger { color: var(--danger); }
.summary-value.warning { color: var(--warning); }

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px 20px;
  margin-bottom: 24px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 6px 0;
  border-bottom: 1px solid var(--border-light);
}

.info-label {
  font-size: 14px;
  color: var(--text-muted);
}

.info-value {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
  font-family: monospace;
}

.info-value.success { color: var(--success); }
.info-value.danger { color: var(--danger); }
.info-value.code {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.alarms-section {
  margin-top: 8px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.title-mark {
  width: 3px;
  height: 14px;
  background: var(--success);
  border-radius: 2px;
}

.section-title span:first-child {
  font-size: 18px;
  font-weight: 500;
  color: var(--text-secondary);
}

.history-count {
  font-size: 14px;
  color: var(--text-muted);
}

.load-more-btn {
  margin-left: auto;
  background: none;
  border: 1px solid var(--border-medium);
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 14px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: var(--transition);
}

.load-more-btn:hover {
  background: var(--bg-primary);
  border-color: var(--info);
  color: var(--info);
}

.load-more-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.alarms-list {
  max-height: 300px;
  overflow-y: auto;
}

.alarms-list::-webkit-scrollbar {
  width: 3px;
}

.alarm-item {
  padding: 12px 14px;
  border-radius: 8px;
  margin-bottom: 8px;
  font-size: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.alarm-item.warning {
  background: rgba(230, 160, 23, 0.08);
  border-left: 3px solid var(--warning);
}

.alarm-item.danger {
  background: rgba(220, 53, 69, 0.08);
  border-left: 3px solid var(--danger);
}

.alarm-time {
  font-family: monospace;
  font-size: 13px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.alarm-type {
  font-size: 13px;
  padding: 2px 6px;
  border-radius: 10px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  flex-shrink: 0;
}

.alarm-message {
  color: var(--text-primary);
  flex: 1;
  font-size: 14px;
}

.alarm-status {
  font-size: 13px;
  padding: 2px 8px;
  border-radius: 10px;
  flex-shrink: 0;
}

.alarm-status.active {
  background: rgba(220, 53, 69, 0.15);
  color: var(--danger);
}

.alarm-status.recovered {
  background: rgba(45, 106, 79, 0.15);
  color: var(--success);
}

.alarms-loading, .alarms-empty {
  text-align: center;
  padding: 24px;
  color: var(--text-muted);
  font-size: 15px;
}

.loading-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid var(--border-light);
  border-top-color: var(--info);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  margin-right: 6px;
  vertical-align: middle;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 480px) {
  .modal-container {
    width: 95%;
    max-width: none;
  }
  .modal-body {
    padding: 16px;
  }
  .info-grid {
    grid-template-columns: 1fr;
    gap: 6px;
  }
  .summary-section {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  .summary-stats {
    width: 100%;
    justify-content: space-between;
  }
  .summary-item {
    text-align: left;
  }
  .alarm-item {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>