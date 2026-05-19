<template>
  <div v-if="visible" class="modal-overlay" @click="handleClose">
    <div class="modal-container" @click.stop>
      <div class="modal-header">
        <div class="header-info">
          <div class="modal-title">📋 最近解码记录</div>
          <div class="device-info">{{ detector?.name || detector?.id }} ({{ detector?.ip || '--' }})</div>
        </div>
        <button class="close-button" @click="handleClose">×</button>
      </div>

      <div class="modal-body">
        <!-- 统计信息 -->
        <div class="stats-bar">
          <div class="stat-item">
            <span class="stat-label">总记录数</span>
            <span class="stat-value">{{ totalCount }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">有效码</span>
            <span class="stat-value success">{{ validCount }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">无效码</span>
            <span class="stat-value danger">{{ invalidCount }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">心跳包</span>
            <span class="stat-value warning">{{ heartbeatCount }}</span>
          </div>
        </div>

        <!-- 搜索过滤 -->
        <div class="filter-bar">
          <input
              type="text"
              v-model="searchText"
              placeholder="搜索码值..."
              class="search-input"
          />
          <select v-model="filterType" class="filter-select">
            <option value="all">全部</option>
            <option value="valid">有效码</option>
            <option value="invalid">无效码</option>
            <option value="heartbeat">心跳包</option>
          </select>
          <button class="refresh-btn" @click="loadDecodeRecords" :disabled="loading">
            🔄
          </button>
        </div>

        <!-- 记录列表 -->
        <div class="records-list" v-if="!loading && filteredRecords.length > 0">
          <div
              v-for="record in filteredRecords"
              :key="record.id"
              class="record-item"
              :class="{
              'valid': record.isValidCode,
              'invalid': record.isFail,
              'heartbeat': record.isHeartbeat
            }"
          >
            <div class="record-time">{{ formatTime(record.receiveTime) }}</div>
            <div class="record-code">
              <span class="code-value">{{ record.codeValue || record.rawText }}</span>
              <span class="code-badge" :class="getBadgeClass(record)">
                {{ getBadgeText(record) }}
              </span>
            </div>
            <div class="record-reader">{{ record.readerName }}</div>
          </div>
        </div>

        <!-- 加载中 -->
        <div class="records-loading" v-else-if="loading">
          <span class="loading-spinner"></span> 加载解码记录...
        </div>

        <!-- 空状态 -->
        <div class="records-empty" v-else-if="!loading && filteredRecords.length === 0">
          <span class="empty-icon">📭</span>
          <span>暂无解码记录</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { decodeResultApi } from '@/api/decodeResult'
import type { DecodeResult } from '@/types/decodeResult'

const props = defineProps<{
  visible: boolean
  detector: any | null
}>()

const emit = defineEmits<{
  close: []
}>()

// 数据状态
const records = ref<DecodeResult[]>([])
const totalCount = ref(0)
const loading = ref(false)

// 过滤条件
const searchText = ref('')
const filterType = ref('all')

// 统计数据
const validCount = computed(() => records.value.filter(r => r.isValidCode && !r.isHeartbeat).length)
const invalidCount = computed(() => records.value.filter(r => r.isFail).length)
const heartbeatCount = computed(() => records.value.filter(r => r.isHeartbeat).length)

// 过滤后的记录
const filteredRecords = computed(() => {
  let result = [...records.value]

  // 按类型过滤
  if (filterType.value === 'valid') {
    result = result.filter(r => r.isValidCode && !r.isHeartbeat)
  } else if (filterType.value === 'invalid') {
    result = result.filter(r => r.isFail)
  } else if (filterType.value === 'heartbeat') {
    result = result.filter(r => r.isHeartbeat)
  }

  // 按码值搜索
  if (searchText.value.trim()) {
    const search = searchText.value.trim().toLowerCase()
    result = result.filter(r =>
        (r.codeValue && r.codeValue.toLowerCase().includes(search)) ||
        (r.rawText && r.rawText.toLowerCase().includes(search))
    )
  }

  return result
})

// 获取徽章样式类
const getBadgeClass = (record: DecodeResult) => {
  if (record.isHeartbeat) return 'heartbeat'
  if (record.isValidCode) return 'valid'
  if (record.isFail) return 'invalid'
  return ''
}

// 获取徽章文本
const getBadgeText = (record: DecodeResult) => {
  if (record.isHeartbeat) return '心跳'
  if (record.isValidCode) return '有效'
  if (record.isFail) return '无效'
  return ''
}

// 加载解码记录
const loadDecodeRecords = async () => {
  if (!props.detector) return

  loading.value = true
  try {
    const response = await decodeResultApi.getRecentDecodeResults({
      readerId: props.detector.id,
      count: 50
    })
    records.value = response.items || []
    totalCount.value = response.count || 0
  } catch (error) {
    console.error('加载解码记录失败:', error)
    records.value = []
    totalCount.value = 0
  } finally {
    loading.value = false
  }
}

// 格式化时间
const formatTime = (timeStr: string) => {
  if (!timeStr) return '--'
  try {
    const date = new Date(timeStr)
    if (isNaN(date.getTime())) return timeStr
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  } catch {
    return timeStr
  }
}

// 关闭弹窗
const handleClose = () => {
  // 重置状态
  records.value = []
  totalCount.value = 0
  searchText.value = ''
  filterType.value = 'all'
  emit('close')
}

// 监听 visible 变化，打开时加载数据
watch(() => props.visible, (newVal) => {
  if (newVal && props.detector) {
    loadDecodeRecords()
  }
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
  max-width: 700px;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: var(--shadow-lg);
  font-size: 16px; /* 放大整体字体 */
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

.modal-title {
  font-size: 22px; /* 放大标题 */
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.device-info {
  font-size: 14px; /* 放大设备信息 */
  color: var(--text-muted);
  font-family: monospace;
}

.close-button {
  background: none;
  border: none;
  font-size: 36px; /* 放大关闭按钮 */
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

.stats-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-light);
}

.stat-item {
  flex: 1;
  text-align: center;
  padding: 8px;
  background: var(--bg-primary);
  border-radius: 10px;
}

.stat-label {
  display: block;
  font-size: 13px; /* 放大统计标签 */
  color: var(--text-muted);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 26px; /* 放大统计数值 */
  font-weight: 700;
  color: var(--text-primary);
}
.stat-value.success { color: var(--success); }
.stat-value.danger { color: var(--danger); }
.stat-value.warning { color: var(--warning); }

.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.search-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px; /* 放大输入框文字 */
  outline: none;
  transition: var(--transition);
}

.search-input:focus {
  border-color: var(--info);
}

.filter-select {
  padding: 8px 12px;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px; /* 放大选择框文字 */
  cursor: pointer;
  outline: none;
}

.refresh-btn {
  background: none;
  border: 1px solid var(--border-light);
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 14px; /* 放大按钮文字 */
  transition: var(--transition);
}

.refresh-btn:hover {
  background: var(--bg-primary);
  border-color: var(--info);
  color: var(--info);
}

.records-list {
  max-height: 400px;
  overflow-y: auto;
}

.records-list::-webkit-scrollbar {
  width: 3px;
}

.record-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-bottom: 1px solid var(--border-light);
  transition: var(--transition);
  font-size: 15px; /* 放大记录项文字 */
}

.record-item:hover {
  background: var(--bg-primary);
}

.record-time {
  font-size: 13px; /* 放大时间 */
  color: var(--text-muted);
  font-family: monospace;
  min-width: 140px;
}

.record-code {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 16px;
}

.code-value {
  font-size: 15px; /* 放大代码值 */
  font-weight: 500;
  font-family: monospace;
  color: var(--text-primary);
}

.code-badge {
  font-size: 12px; /* 放大徽章 */
  padding: 2px 8px;
  border-radius: 12px;
}

.code-badge.valid {
  background: rgba(45, 106, 79, 0.15);
  color: var(--success);
}
.code-badge.invalid {
  background: rgba(220, 53, 69, 0.15);
  color: var(--danger);
}
.code-badge.heartbeat {
  background: rgba(230, 160, 23, 0.15);
  color: var(--warning);
}

.record-reader {
  font-size: 13px; /* 放大读者列 */
  color: var(--text-muted);
  min-width: 60px;
  text-align: right;
}

.record-item.valid {
  border-left: 2px solid var(--success);
}
.record-item.invalid {
  border-left: 2px solid var(--danger);
}
.record-item.heartbeat {
  border-left: 2px solid var(--warning);
}

.records-loading, .records-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-muted);
  gap: 12px;
  font-size: 16px;
}

.empty-icon {
  font-size: 48px;
  opacity: 0.5;
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

@media (max-width: 768px) {
  .modal-container {
    width: 95%;
  }
  .modal-body {
    padding: 16px;
  }
  .stats-bar {
    flex-wrap: wrap;
  }
  .stat-item {
    min-width: calc(50% - 8px);
  }
  .record-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .record-code {
    margin: 0;
    width: 100%;
  }
  .record-reader {
    text-align: left;
  }
}
</style>