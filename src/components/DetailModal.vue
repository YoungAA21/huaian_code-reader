<!-- DetailModal.vue - 弹窗优化 -->
<template>
  <div v-if="detector" class="modal-overlay" @click="$emit('close')">
    <div class="modal-container" @click.stop>
      <div class="modal-header">
        <div class="header-info">
          <div class="device-title">{{ detector.name }}</div>
          <div class="device-sub">{{ detector.id }}</div>
        </div>
        <button class="close-button" @click="$emit('close')">×</button>
      </div>

      <div class="modal-body">
        <!-- 状态摘要 -->
        <div class="summary-section">
          <div class="status-badge" :class="getStatusClass">
            {{ detector.status || 'UNKNOWN' }}
          </div>
          <div class="summary-stats">
            <div class="summary-item">
              <span class="summary-label">当前值</span>
              <strong class="summary-value" :class="getValueClass">{{ detector.displayValue.toFixed(0) }}ms</strong>
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
            <span class="info-label">设备IP</span>
            <span class="info-value">{{ detector.device }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">产线</span>
            <span class="info-value">{{ detector.lineName }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">工位</span>
            <span class="info-value">{{ detector.stationName }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">最后心跳</span>
            <span class="info-value">{{ detector.lastHeartbeat || '--' }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">触发次数</span>
            <span class="info-value">{{ detector.lastTriggerIndex || 0 }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">累计时间</span>
            <span class="info-value">{{ detector.lastTotalTime || 0 }}秒</span>
          </div>
          <div class="info-row" v-if="detector.lastCode">
            <span class="info-label">最新码</span>
            <span class="info-value code">{{ detector.lastCode }}</span>
          </div>
        </div>

        <!-- 报警记录 -->
        <div class="alarms-section">
          <div class="section-title">
            <span class="title-mark"></span>
            <span>报警记录</span>
          </div>
          <div class="alarms-list">
            <div v-for="alarm in detector.alarms.slice(0, 5)" :key="alarm.id"
                 class="alarm-item" :class="alarm.level">
              <span class="alarm-time">{{ alarm.time }}</span>
              <span class="alarm-message">{{ alarm.message }}</span>
            </div>
            <div v-if="detector.alarms.length === 0" class="alarms-empty">
              暂无报警记录
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ detector: any | null }>()
defineEmits<{ close: [] }>()

const TEMP_THRESHOLD = { warning: 45, danger: 60 }

const getStatusClass = computed(() => {
  if (!props.detector) return ''
  const status = props.detector.status
  if (status === 'DANGER') return 'danger'
  if (status === 'WARNING') return 'warning'
  if (status === 'ONLINE' || status === 'OK') return 'normal'
  return 'offline'
})

const getValueClass = computed(() => {
  if (!props.detector) return ''
  const val = props.detector.displayValue
  if (val >= 90) return 'danger'
  if (val >= 70) return 'warning'
  return ''
})

const getTempClass = computed(() => {
  if (!props.detector) return ''
  const temp = props.detector.temperature || 0
  if (temp >= TEMP_THRESHOLD.danger) return 'danger'
  if (temp >= TEMP_THRESHOLD.warning) return 'warning'
  return ''
})
</script>

<style scoped>
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
  max-width: 560px;
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
  font-size: 15px;
  color: var(--text-muted);
  font-family: monospace;
}

.close-button {
  background: none;
  border: none;
  font-size: 40px;
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
  font-size: 15px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.summary-value {
  font-size: 27px;
  font-weight: 700;
  font-family: monospace;
  color: var(--text-primary);
}

.summary-value.danger { color: var(--danger); }
.summary-value.warning { color: var(--warning); }

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px 24px;
  margin-bottom: 24px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-light);
}

.info-label {
  font-size: 13px;
  color: var(--text-muted);
}

.info-value {
  font-size: 19px;
  font-weight: 500;
  color: var(--text-primary);
  font-family: monospace;
}

.info-value.code {
  font-size: 16px;
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
}

.title-mark {
  width: 3px;
  height: 14px;
  background: var(--success);
  border-radius: 2px;
}

.section-title span:last-child {
  font-size: 18px;
  font-weight: 500;
  color: var(--text-secondary);
}

.alarms-list {
  max-height: 200px;
  overflow-y: auto;
}

.alarms-list::-webkit-scrollbar {
  width: 3px;
}

.alarm-item {
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 8px;
  font-size: 18px;
  display: flex;
  gap: 12px;
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
  font-size: 15px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.alarm-message {
  color: var(--text-primary);
  flex: 1;
}

.alarms-empty {
  text-align: center;
  padding: 24px;
  color: var(--text-muted);
  font-size: 15px;
}

@media (max-width: 480px) {
  .modal-container {
    width: 95%;
  }
  .modal-body {
    padding: 16px;
  }
  .info-grid {
    grid-template-columns: 1fr;
    gap: 8px;
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
}
</style>