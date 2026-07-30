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
        <div class="summary-section">
          <div class="status-badge" :class="getStatusClass">
            {{ getStatusText() }}
          </div>
          <div class="summary-stats">
            <div class="summary-item primary">
              <span class="summary-label">修正成功率</span>
              <strong class="summary-value" :class="getTriggerHealthClass">{{ formatPercent(detector.triggerEffectiveSuccessRate) }}</strong>
            </div>
            <div class="summary-item">
              <span class="summary-label">严格成功率</span>
              <strong class="summary-value">{{ formatPercent(detector.triggerSuccessRate) }}</strong>
            </div>
            <div class="summary-item">
              <span class="summary-label">设备温度</span>
              <strong class="summary-value" :class="getTempClass">{{ formatTemperature(detector.temperature) }}</strong>
            </div>
          </div>
        </div>

        <div class="info-grid realtime-grid">
          <div class="info-row">
            <span class="info-label">设备ID</span>
            <span class="info-value">{{ detector.id || '--' }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">读码器名称</span>
            <span class="info-value">{{ detector.stationName || detector.name || '--' }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">设备IP</span>
            <span class="info-value">{{ detector.ip || '--' }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">产线</span>
            <span class="info-value">{{ detector.lineId || detector.lineName || '--' }}</span>
          </div>
          <div class="info-row important">
            <span class="info-label">延迟补码率</span>
            <span class="info-value">{{ formatPercent(detector.triggerLateRecoveredRate) }}</span>
          </div>
          <div class="info-row important">
            <span class="info-label">补码数</span>
            <span class="info-value">{{ formatCount(detector.triggerLateRecoveredCount) }}</span>
          </div>
          <div class="info-row important">
            <span class="info-label">待补NoResult</span>
            <span class="info-value" :class="detector.triggerPendingNoResultCount > 0 ? 'warning' : ''">
              {{ formatCount(detector.triggerPendingNoResultCount) }}
            </span>
          </div>
          <div class="info-row important">
            <span class="info-label">最近跨周期</span>
            <span class="info-value">{{ formatCycleOffset(detector.triggerLastLateOffsetCycles) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">触发周期</span>
            <span class="info-value">{{ formatMs(detector.triggerLastIntervalMs) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">有效码延时</span>
            <span class="info-value">{{ formatMs(detector.triggerLastSuccessDelayMs) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">读码返回间隔</span>
            <span class="info-value">{{ formatMs(detector.triggerLastReceiveIntervalMs) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">最近有效码间隔</span>
            <span class="info-value">{{ formatMs(detector.lastValidCodeIntervalMs) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">TCP连接</span>
            <span class="info-value" :class="detector.tcpConnected ? 'success' : 'danger'">
              {{ detector.tcpConnected ? '已连接' : '未连接' }}
            </span>
          </div>
          <div class="info-row">
            <span class="info-label">Ping</span>
            <span class="info-value" :class="detector.pingOk ? 'success' : 'danger'">
              {{ detector.pingOk ? '正常' : '异常' }}
            </span>
          </div>
          <div class="info-row">
            <span class="info-label">Modbus温度采集</span>
            <span class="info-value" :class="detector.modbusOk ? 'success' : 'danger'">
              {{ detector.modbusOk ? '正常' : '异常' }}
            </span>
          </div>
          <div class="info-row">
            <span class="info-label">最后业务结果</span>
            <span class="info-value">{{ formatTime(detector.lastBusinessResultTime || detector.lastValidCodeTime) }}</span>
          </div>
          <div class="info-row full">
            <span class="info-label">更新时间</span>
            <span class="info-value">{{ formatTime(detector.updatedTime) || detector.lastUpdateTime || '--' }}</span>
          </div>
        </div>

        <div class="alarms-section">
          <div class="section-title">
            <span class="title-mark"></span>
            <span>历史告警记录</span>
            <span v-if="historyTotal > 0" class="history-count">（共{{ historyTotal }}条）</span>
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

// 鍘嗗彶鍛婅鏁版嵁
const historyAlarms = ref<Alarm[]>([])
const historyTotal = ref(0)
const historyPage = ref(1)
const loadingHistory = ref(false)
const hasMore = ref(true)

// 鑾峰彇璁惧鐨勮嚜瀹氫箟娓╁害闃堝€?
const getTempThreshold = (detector: any) => {
  return detector.customTempThreshold || { warning: 45, danger: 60 }
}

// 鑾峰彇鐘舵€佹枃鏈?
const getStatusText = () => {
  if (!props.detector) return '未知'
  return props.detector.statusText || '未知'
}

// 鑾峰彇鐘舵€佹牱寮忕被
const getStatusClass = computed(() => {
  if (!props.detector) return ''
  return props.detector.status || 'unknown'
})

const getTriggerHealthClass = computed(() => {
  if (!props.detector) return ''
  const status = String(props.detector.triggerCycleHealthStatus || '')
  if (status === 'Critical') return 'danger'
  if (status === 'Warning') return 'warning'
  if (status === 'Healthy') return 'success'
  return ''
})

const formatPercent = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--'
  return `${Number(value).toFixed(1)}%`
}

const formatMs = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--'
  return `${Number(value).toFixed(0)}ms`
}

const formatCount = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--'
  return Number(value).toLocaleString('zh-CN')
}

const formatCycleOffset = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--'
  return `${Number(value)} 周期`
}

const formatTemperature = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--'
  if (Number(value) === 0 && !props.detector?.modbusOk) return '--'
  return `${Number(value).toFixed(1)}°C`
}

// 鑾峰彇娓╁害鏍峰紡绫?
const getTempClass = computed(() => {
  if (!props.detector) return ''
  const temp = props.detector.temperature || 0
  const threshold = getTempThreshold(props.detector)
  if (temp >= threshold.danger) return 'danger'
  if (temp >= threshold.warning) return 'warning'
  return ''
})

// 鑾峰彇鍛婅绾у埆鏍峰紡绫?
const getAlarmLevelClass = (level: number) => {
  if (level >= 2) return 'danger'
  return 'warning'
}

// 鑾峰彇鍛婅绫诲瀷鏂囨湰
const getAlarmTypeText = (type: number) => {
  const typeMap: Record<number, string> = {
    1: '超时',
    7: 'Ping失败',
    9: '心跳丢失',
    10: 'TCP断开'
  }
  return typeMap[type] || `类型${type}`
}

// 鍔犺浇鍘嗗彶鍛婅
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

    // 鍒ゆ柇鏄惁杩樻湁鏇村鏁版嵁
    hasMore.value = historyAlarms.value.length < historyTotal.value

    if (response.items.length > 0) {
      historyPage.value++
    }
  } catch (error) {
    console.error('鍔犺浇鍘嗗彶鍛婅澶辫触:', error)
  } finally {
    loadingHistory.value = false
  }
}

// 鍔犺浇鏇村
const loadMoreHistory = () => {
  if (!loadingHistory.value && hasMore.value) {
    loadHistoryAlarms(false)
  }
}

// 鍏抽棴寮圭獥
const handleClose = () => {
  // 閲嶇疆鐘舵€?
  historyAlarms.value = []
  historyTotal.value = 0
  historyPage.value = 1
  hasMore.value = true
  emit('close')
}

// 鏍煎紡鍖栨椂闂?
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

// 鐩戝惉 detector 鍙樺寲锛屽姞杞藉巻鍙插憡璀?
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
  position: relative;
  background: var(--bg-card);
  border-radius: 16px;
  width: 90%;
  max-width: 920px;
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
  position: sticky;
  top: 0;
  right: 0;
  z-index: 5;
  width: 54px;
  height: 54px;
  margin-top: -6px;
  margin-right: -8px;
  border: 1px solid var(--border-medium);
  border-radius: 12px;
  background: var(--bg-secondary);
  box-shadow: var(--shadow-sm);
  font-size: 42px;
  font-weight: 300;
  cursor: pointer;
  color: var(--text-secondary);
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
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: stretch;
  gap: 16px;
  margin-bottom: 24px;
  padding: 16px;
  border: 1px solid var(--border-light);
  border-radius: 12px;
  background:
      linear-gradient(135deg, rgba(47, 111, 237, 0.08), rgba(45, 106, 79, 0.05)),
      var(--bg-secondary);
}

.status-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 92px;
  padding: 8px 16px;
  border-radius: 10px;
  font-size: 18px;
  font-weight: 800;
}

.status-badge.unknown {
  background: rgba(154, 174, 191, 0.1);
  color: var(--text-muted);
}
.status-badge.offline {
  background: rgba(173, 181, 189, 0.1);
  color: var(--border-heavy);
}
.status-badge.connecting {
  background: rgba(74, 144, 226, 0.1);
  color: var(--info);
}
.status-badge.online {
  background: rgba(45, 106, 79, 0.1);
  color: var(--success);
}
.status-badge.warning {
  background: rgba(230, 160, 23, 0.1);
  color: var(--warning);
}
.status-badge.fault {
  background: rgba(220, 53, 69, 0.1);
  color: var(--danger);
}
.status-badge.maintenance {
  background: var(--primary-soft);
  color: var(--primary);
}

.summary-stats {
  display: grid;
  grid-template-columns: 1.15fr 1fr 1fr;
  gap: 12px;
}

.summary-item {
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid rgba(63, 175, 255, 0.14);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  text-align: left;
}

.summary-label {
  display: block;
  font-size: 15px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  font-weight: 800;
}

.summary-value {
  font-size: 36px;
  font-weight: 900;
  font-family: 'SF Mono', 'JetBrains Mono', monospace;
  color: var(--text-primary);
  line-height: 1;
}

.summary-value.danger { color: var(--danger); }
.summary-value.warning { color: var(--warning); }
.summary-value.success { color: var(--success); }

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px 20px;
  margin-bottom: 24px;
}

.realtime-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.info-row {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  justify-content: center;
  padding: 10px 12px;
  border: 1px solid var(--border-light);
  border-radius: 9px;
  background: var(--bg-secondary);
}

.info-row.important {
  border-color: rgba(47, 111, 237, 0.18);
  background: rgba(47, 111, 237, 0.06);
}

.info-row.full {
  grid-column: span 2;
}

.info-label {
  font-size: 14px;
  color: var(--text-muted);
  font-weight: 800;
}

.info-value {
  overflow: hidden;
  font-size: 17px;
  font-weight: 800;
  color: var(--text-primary);
  font-family: 'SF Mono', 'JetBrains Mono', monospace;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.info-value.success { color: var(--success); }
.info-value.danger { color: var(--danger); }
.info-value.warning { color: var(--warning); }
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
