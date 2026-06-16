<template>
  <main class="trend-page">
    <header class="page-header">
      <div>
        <p class="eyebrow">读码器趋势对比</p>
        <h1>温度、解码耗时与车速</h1>
      </div>
      <RouterLink class="back-link" to="/">返回监控大屏</RouterLink>
    </header>

    <section class="controls-panel">
      <div class="group-tabs" aria-label="读码器分组">
        <button
            v-for="group in readerGroups"
            :key="group.key"
            type="button"
            :class="{ active: group.key === activeGroupKey }"
            @click="selectGroup(group.key)"
        >
          {{ group.label }}
        </button>
      </div>

      <div class="time-selector-row">
        <label class="picker-field">
          <span>开始时间</span>
          <input
              v-model="startTimeInput"
              type="datetime-local"
              step="1"
              class="trend-date-picker"
          />
        </label>
        <label class="picker-field">
          <span>结束时间</span>
          <input
              v-model="endTimeInput"
              type="datetime-local"
              step="1"
              class="trend-date-picker"
          />
        </label>
      </div>

      <div class="actions-row">
        <button type="button" class="primary-button" :disabled="loading" @click="fetchActiveGroup">
          {{ loading ? '查询中...' : '查询趋势' }}
        </button>
        <span v-if="errorMessage" class="error-text">{{ errorMessage }}</span>
      </div>
    </section>

    <section class="compare-grid">
      <ReaderDualTrendChart
          v-for="readerId in activeGroup.readerIds"
          :key="readerId"
          :reader-id="readerId"
          :points="snapshots[readerId] || []"
          :alarms="alarms[readerId] || []"
          :production-points="productionSnapshots"
          :range-start="startTime"
          :range-end="endTime"
      />
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import ReaderDualTrendChart from '@/components/ReaderDualTrendChart.vue'
import { readerApi } from '@/api/reader'
import { alarmApi } from '@/api/alarm'
import { productionApi } from '@/api/production'
import type { ReaderSnapshot } from '@/types/reader'
import type { Alarm } from '@/types/alarm'
import type { ProductionSnapshot } from '@/types/production'

interface ReaderGroup {
  key: string
  label: string
  readerIds: [string, string]
}

const readerGroups: ReaderGroup[] = [
  { key: 'r01-r02', label: 'R01 / R02', readerIds: ['R01', 'R02'] },
  { key: 'r03-r04', label: 'R03 / R04', readerIds: ['R03', 'R04'] },
  { key: 'r05-r08', label: 'R05 / R08', readerIds: ['R05', 'R08'] },
  { key: 'r06-r07', label: 'R06 / R07', readerIds: ['R06', 'R07'] },
]

const activeGroupKey = ref(readerGroups[0].key)
const loading = ref(false)
const errorMessage = ref('')
const snapshots = reactive<Record<string, ReaderSnapshot[]>>({})
const alarms = reactive<Record<string, Alarm[]>>({})
const productionSnapshots = ref<ProductionSnapshot[]>([])
let requestSequence = 0

const now = new Date()
const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000)

const formatInputDate = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
      `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

const startTimeInput = ref(formatInputDate(tenMinutesAgo))
const endTimeInput = ref(formatInputDate(now))
const startTime = computed(() => new Date(startTimeInput.value))
const endTime = computed(() => new Date(endTimeInput.value))

readerGroups.flatMap(group => group.readerIds).forEach((readerId) => {
  snapshots[readerId] = []
  alarms[readerId] = []
})

const activeGroup = computed(() => {
  return readerGroups.find(group => group.key === activeGroupKey.value) || readerGroups[0]
})

const toApiTime = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
}

const selectGroup = (groupKey: string) => {
  activeGroupKey.value = groupKey
  fetchActiveGroup()
}

const fetchReaderAlarms = async (
    readerId: string,
    startTimeFrom: string,
    startTimeTo: string
) => {
  const pageSize = 200
  const firstPage = await alarmApi.getHistoryAlarms({
    readerId,
    startTimeFrom,
    startTimeTo,
    pageIndex: 1,
    pageSize
  })
  const items = [...(firstPage.items || [])]
  const pageCount = Math.ceil(firstPage.total / pageSize)

  if (pageCount > 1) {
    const remainingPages = await Promise.all(
        Array.from({ length: pageCount - 1 }, (_, index) =>
            alarmApi.getHistoryAlarms({
              readerId,
              startTimeFrom,
              startTimeTo,
              pageIndex: index + 2,
              pageSize
            })
        )
    )
    remainingPages.forEach(page => items.push(...(page.items || [])))
  }

  return items
}

const fetchReader = async (readerId: string, sequence: number) => {
  const startTimeFrom = toApiTime(startTime.value)
  const startTimeTo = toApiTime(endTime.value)

  const [snapshotResponse, alarmItems] = await Promise.all([
    readerApi.getReaderRecentSnapshots({
      readerId,
      startTime: startTimeFrom,
      endTime: startTimeTo,
    }),
    fetchReaderAlarms(readerId, startTimeFrom, startTimeTo)
  ])

  if (sequence !== requestSequence) return
  snapshots[readerId] = snapshotResponse.items || []
  alarms[readerId] = alarmItems
}

const fetchActiveGroup = async () => {
  if (!Number.isFinite(startTime.value.getTime()) || !Number.isFinite(endTime.value.getTime())) {
    errorMessage.value = '请选择有效的开始和结束时间'
    return
  }

  if (startTime.value.getTime() > endTime.value.getTime()) {
    errorMessage.value = '开始时间不能晚于结束时间'
    return
  }

  loading.value = true
  errorMessage.value = ''
  const sequence = ++requestSequence
  const startTimeFrom = toApiTime(startTime.value)
  const startTimeTo = toApiTime(endTime.value)

  try {
    const [productionResponse] = await Promise.all([
      productionApi.getProductionSnapshots({
        startTime: startTimeFrom,
        endTime: startTimeTo,
        limit: 10000
      }),
      ...activeGroup.value.readerIds.map(readerId => fetchReader(readerId, sequence))
    ])

    if (sequence !== requestSequence) return
    productionSnapshots.value = productionResponse.items || []
  } catch (error) {
    if (sequence !== requestSequence) return
    console.error('查询读码器趋势失败:', error)
    errorMessage.value = '查询失败，请检查接口服务或时间范围'
  } finally {
    if (sequence === requestSequence) loading.value = false
  }
}

onMounted(fetchActiveGroup)
</script>
<style scoped>
.trend-page {
  width: 100vw;
  height: 100vh;
  overflow-y: auto;
  background: var(--bg-primary);
  color: var(--text-primary);
  padding: 24px 32px 40px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-light);
}

.eyebrow {
  margin: 0 0 4px;
  color: var(--primary);
  font-size: 14px;
  font-weight: 700;
}

.page-header h1 {
  margin: 0;
  color: var(--text-primary);
  font-size: 28px;
  line-height: 1.2;
  letter-spacing: 0;
}

.back-link,
.primary-button {
  border: 1px solid var(--primary);
  background: var(--primary-soft);
  color: var(--primary);
  border-radius: 8px;
  padding: 9px 14px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  text-decoration: none;
  transition: var(--transition);
}

.back-link:hover,
.primary-button:hover:not(:disabled) {
  background: var(--primary);
  color: var(--text-inverse);
}

.primary-button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.controls-panel {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 18px;
  box-shadow: var(--shadow-sm);
}

.group-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.group-tabs button {
  min-height: 38px;
  border: 1px solid var(--border-medium);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

.group-tabs button.active {
  border-color: var(--primary);
  background: var(--primary);
  color: var(--text-inverse);
}

.time-selector-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.picker-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 700;
}

.trend-date-picker {
  width: 100%;
  min-height: 38px;
  padding: 7px 10px;
  border: 1px solid var(--border-medium);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  color-scheme: inherit;
}

.trend-date-picker:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary-soft);
}

.actions-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
}

.error-text {
  color: var(--danger);
  font-size: 14px;
  font-weight: 700;
}

.compare-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

@media (max-width: 1100px) {
  .time-selector-row,
  .compare-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .trend-page {
    padding: 16px;
  }

  .page-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .page-header h1 {
    font-size: 24px;
  }
}
</style>

