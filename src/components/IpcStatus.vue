<template>
  <div class="ipc-status-card">
    <div class="card-header">
      <div class="header-title">
        <span class="icon">🖥️</span>
        <span>工控机状态</span>
      </div>
      <div class="header-actions">
        <span class="status-badge" :class="ipcStatus?.agentOnline ? 'online' : 'offline'">
          {{ ipcStatus?.agentOnline ? '在线' : '离线' }}
        </span>
        <button class="history-btn" @click="showHistory = !showHistory">
          {{ showHistory ? '收起历史' : '查看历史' }}
        </button>
        <button class="refresh-btn" @click="fetchIpcStatus" :disabled="loading">
          🔄
        </button>
      </div>
    </div>

    <!-- 当前状态 -->
    <div class="status-content" v-if="ipcStatus && !loading">
      <div class="status-grid">
        <div class="status-item">
          <div class="item-label">CPU使用率</div>
          <div class="item-value" :class="getCpuClass(ipcStatus.systemCpuUsagePercent)">
            {{ ipcStatus.systemCpuUsagePercent.toFixed(2) }}%
          </div>
          <div class="item-bar">
            <div class="bar-fill" :style="{ width: Math.min(ipcStatus.systemCpuUsagePercent, 100) + '%' }" :class="getCpuClass(ipcStatus.systemCpuUsagePercent)"></div>
          </div>
        </div>

        <div class="status-item">
          <div class="item-label">内存使用率</div>
          <div class="item-value" :class="getMemoryClass(ipcStatus.systemMemoryUsagePercent)">
            {{ ipcStatus.systemMemoryUsagePercent.toFixed(2) }}%
          </div>
          <div class="item-bar">
            <div class="bar-fill memory-bar" :style="{ width: Math.min(ipcStatus.systemMemoryUsagePercent, 100) + '%' }" :class="getMemoryClass(ipcStatus.systemMemoryUsagePercent)"></div>
          </div>
        </div>

        <div class="status-item">
          <div class="item-label">磁盘使用率</div>
          <div class="item-value" :class="getDiskClass(ipcStatus.diskUsagePercent)">
            {{ ipcStatus.diskUsagePercent.toFixed(2) }}%
          </div>
          <div class="item-bar">
            <div class="bar-fill" :style="{ width: ipcStatus.diskUsagePercent + '%' }" :class="getDiskClass(ipcStatus.diskUsagePercent)"></div>
          </div>
          <div class="item-sub">
            {{ ipcStatus.diskFreeGb.toFixed(0) }} GB / {{ ipcStatus.diskTotalGb.toFixed(0) }} GB
          </div>
        </div>

        <div class="status-item">
          <div class="item-label">运行时长</div>
          <div class="item-value">{{ formatUptime(ipcStatus.appUptimeHours) }}</div>
        </div>

        <div class="status-item">
          <div class="item-label">进程ID</div>
          <div class="item-value">{{ ipcStatus.processId }}</div>
        </div>

        <div class="status-item">
          <div class="item-label">数据库状态</div>
          <div class="item-value" :class="ipcStatus.localDatabaseOk ? 'success' : 'danger'">
            {{ ipcStatus.localDatabaseOk ? '正常' : '异常' }}
          </div>
        </div>
      </div>

      <div class="status-message" :class="getHealthClass(ipcStatus.healthStatus)">
        {{ ipcStatus.message }}
      </div>
    </div>

    <div class="status-loading" v-else-if="loading">
      <span class="loading-spinner"></span>
      加载中...
    </div>

    <div class="status-error" v-else-if="error">
      ⚠️ {{ error }}
    </div>

    <!-- 历史记录 -->
    <div class="history-section" v-if="showHistory">
      <div class="history-header">
        <span>历史记录 (最近 {{ historyItems.length }} 条)</span>
        <button class="refresh-history" @click="fetchIpcHistory">刷新</button>
      </div>
      <div class="history-table-wrapper">
        <table class="history-table">
          <thead>
          <tr>
            <th>时间</th>
            <th>CPU%</th>
            <th>内存%</th>
            <th>磁盘%</th>
            <th>状态</th>
          </tr>
          </thead>
          <tbody>
          <tr v-for="item in historyItems" :key="item.time">
            <td>{{ formatTime(item.time) }}</td>
            <td :class="getCpuClass(item.systemCpuUsagePercent)">{{ item.systemCpuUsagePercent.toFixed(2) }}%</td>
            <td :class="getMemoryClass(item.systemMemoryUsagePercent)">{{ item.systemMemoryUsagePercent.toFixed(2) }}%</td>
            <td :class="getDiskClass(item.diskUsagePercent)">{{ item.diskUsagePercent.toFixed(2) }}%</td>
            <td>
              <span class="status-dot" :class="item.agentOnline ? 'online' : 'offline'"></span>
              {{ item.agentOnline ? '在线' : '离线' }}
            </td>
          </tr>
          <tr v-if="historyItems.length === 0">
            <td colspan="5" class="empty-row">暂无历史数据</td>
          </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ipcApi } from '@/api/ipc'
import type { IpcStatus, IpcHistoryItem } from '@/types/ipc'

const props = defineProps<{
  realtimeStatus: IpcStatus | null
}>()

const ipcStatus = ref<IpcStatus | null>(props.realtimeStatus)
const historyItems = ref<IpcHistoryItem[]>([])
const loading = ref(false)
const error = ref('')
const showHistory = ref(false)

// 获取工控机状态
const fetchIpcStatus = async () => {
  try {
    loading.value = true
    error.value = ''
    ipcStatus.value = await ipcApi.getIpcStatus()
  } catch (err: any) {
    error.value = err.message || '获取状态失败'
    console.error('获取工控机状态失败:', err)
  } finally {
    loading.value = false
  }
}

// 获取历史记录
const fetchIpcHistory = async () => {
  try {
    const history = await ipcApi.getIpcHistory({ count: 20 })
    historyItems.value = history.items
  } catch (err: any) {
    console.error('获取历史记录失败:', err)
  }
}

// 格式化运行时长
const formatUptime = (hours: number) => {
  if (hours < 1) {
    const minutes = Math.floor(hours * 60)
    return `${minutes}分钟`
  }
  if (hours < 24) {
    return `${hours.toFixed(1)}小时`
  }
  const days = Math.floor(hours / 24)
  const remainHours = (hours % 24).toFixed(0)
  return `${days}天${remainHours}小时`
}

// 格式化时间
const formatTime = (timeStr: string) => {
  const date = new Date(timeStr)
  return date.toLocaleTimeString('zh-CN', { hour12: false })
}

// CPU 颜色类
const getCpuClass = (cpu: number) => {
  if (cpu >= 80) return 'danger'
  if (cpu >= 50) return 'warning'
  return 'success'
}

const getMemoryClass = (memory: number) => {
  if (memory >= 80) return 'danger'
  if (memory >= 60) return 'warning'
  return 'success'
}

// 磁盘颜色类
const getDiskClass = (disk: number) => {
  if (disk >= 90) return 'danger'
  if (disk >= 70) return 'warning'
  return 'success'
}

// 健康状态类
const getHealthClass = (health: number) => {
  if (health === 1) return 'success'
  if (health === 2) return 'warning'
  return 'danger'
}

// 监听历史展开
watch(() => props.realtimeStatus, (status) => {
  if (status) {
    ipcStatus.value = status
    loading.value = false
    error.value = ''
  }
}, { immediate: true })

watch(showHistory, (newVal) => {
  if (newVal && historyItems.value.length === 0) {
    fetchIpcHistory()
  }
})
</script>

<style scoped>
.ipc-status-card {
  background: var(--bg-card);
  border-radius: 12px;
  margin-bottom: 20px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-light);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.header-title .icon {
  font-size: 22px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 15px;
  font-weight: 500;
}

.status-badge.online {
  background: rgba(45, 106, 79, 0.15);
  color: var(--success);
}

.status-badge.offline {
  background: rgba(220, 53, 69, 0.15);
  color: var(--danger);
}

.history-btn, .refresh-btn, .refresh-history {
  background: none;
  border: 1px solid var(--border-medium);
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 15px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: var(--transition);
}

.history-btn:hover, .refresh-btn:hover, .refresh-history:hover {
  background: var(--bg-primary);
  border-color: var(--info);
  color: var(--info);
}

.refresh-btn {
  padding: 4px 8px;
  font-size: 16px;
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.status-content {
  padding: 16px;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.status-item {
  background: var(--bg-primary);
  padding: 10px 12px;
  border-radius: 8px;
}

.item-label {
  font-size: 14px;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.item-value {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
}

.item-value.success { color: var(--success); }
.item-value.warning { color: var(--warning); }
.item-value.danger { color: var(--danger); }

.item-bar {
  margin-top: 8px;
  height: 6px;
  background: var(--border-light);
  border-radius: 3px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.bar-fill.success { background: var(--success); }
.bar-fill.warning { background: var(--warning); }
.bar-fill.danger { background: var(--danger); }
.bar-fill.memory-bar { background: var(--info); }

.item-sub {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 6px;
}

.status-message {
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 15px;
  background: var(--bg-primary);
}

.status-message.success {
  color: var(--success);
  background: rgba(45, 106, 79, 0.1);
}

.status-message.warning {
  color: var(--warning);
  background: rgba(230, 160, 23, 0.1);
}

.status-message.danger {
  color: var(--danger);
  background: rgba(220, 53, 69, 0.1);
}

.status-loading, .status-error {
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
}

.status-error {
  color: var(--danger);
}

.loading-spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-light);
  border-top-color: var(--info);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  margin-right: 8px;
  vertical-align: middle;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 历史记录样式 */
.history-section {
  border-top: 1px solid var(--border-light);
  padding: 14px 16px;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 16px;
  font-weight: 500;
  color: var(--text-secondary);
}

.history-table-wrapper {
  max-height: 300px;
  overflow-y: auto;
}

.history-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 15px;
}

.history-table th,
.history-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border-light);
}

.history-table th {
  background: var(--bg-tertiary);
  font-weight: 500;
  color: var(--text-secondary);
  position: sticky;
  top: 0;
}

.history-table td {
  color: var(--text-primary);
}

.history-table .success { color: var(--success); }
.history-table .warning { color: var(--warning); }
.history-table .danger { color: var(--danger); }

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
}

.status-dot.online {
  background: var(--success);
  box-shadow: 0 0 4px var(--success);
}

.status-dot.offline {
  background: var(--danger);
}

.empty-row {
  text-align: center;
  color: var(--text-muted);
  padding: 30px;
}

/* 暗色模式适配 */
.dark-theme .status-item {
  background: var(--bg-secondary);
}
</style>
