<template>
  <main class="spare-page">
    <header class="page-header">
      <div>
        <h1>备件管理</h1>
        <p>按安装位置管理当前备件与历次更换记录</p>
      </div>
      <div class="header-actions">
        <RouterLink class="button secondary" to="/">返回监控大屏</RouterLink>
      </div>
    </header>

    <section v-if="activeView === 'status'" class="data-section">
      <div class="toolbar">
        <div class="list-actions">
          <button type="button" class="button primary add-location-button" @click="openLocationDialog()">添加备件位置</button>
          <button type="button" class="button secondary" :disabled="loading" @click="refreshCurrentView">
            {{ loading ? '刷新中...' : '刷新' }}
          </button>
        </div>
        <label class="search-field">
          <span>搜索</span>
          <input v-model.trim="keyword" type="search" placeholder="位置编号、位置名称、备件名称、物料号或序列号" />
        </label>
        <span class="result-count">显示 {{ filteredStatusItems.length }} / {{ statusItems.length }} 条</span>
      </div>

      <div v-if="errorMessage" class="feedback error">{{ errorMessage }}</div>
      <div v-if="successMessage" class="feedback success">{{ successMessage }}</div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>位置编号 / 名称</th>
              <th>当前备件</th>
              <th>备件型号 / 序列号</th>
              <th>安装时间</th>
              <th class="number-cell">使用时长</th>
              <th>操作人</th>
              <th class="actions-cell">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading && statusItems.length === 0">
              <td colspan="7" class="empty-cell">正在加载备件状态...</td>
            </tr>
            <tr v-else-if="filteredStatusItems.length === 0">
              <td colspan="7" class="empty-cell">暂无符合条件的备件</td>
            </tr>
            <tr v-for="item in filteredStatusItems" :key="item.locationId">
              <td>
                <strong class="primary-value">{{ item.locationId }}</strong>
                <span class="secondary-value">{{ item.locationName }}</span>
              </td>
              <td>
                <template v-if="item.hasReplacementRecord">
                  <strong class="primary-value">{{ item.sparePartName || '--' }}</strong>
                  <span class="secondary-value">{{ item.sparePartType || '--' }}</span>
                </template>
                <span v-else class="status-chip pending">未安装</span>
              </td>
              <td>
                <span class="primary-value">{{ item.partNo || '--' }}</span>
                <span class="secondary-value">{{ item.serialNo || '--' }}</span>
              </td>
              <td>
                <template v-if="item.hasReplacementRecord">
                  <span class="primary-value">{{ formatDateTime(item.replacementTime) }}</span>
                  <span class="secondary-value">记录于 {{ formatDateTime(item.recordCreatedTime) }}</span>
                </template>
                <span v-else>--</span>
              </td>
              <td class="number-cell">
                <template v-if="item.installedHours !== null">
                  <strong class="duration-days">{{ formatDays(item.installedDays) }}</strong>
                  <span class="secondary-value">{{ formatHours(item.installedHours) }}</span>
                </template>
                <span v-else>--</span>
              </td>
              <td>{{ item.replacedBy || '--' }}</td>
              <td class="actions-cell">
                <button type="button" class="table-action primary-action" :disabled="!item.enabled" @click="openReplacementDialog(item)">更换备件</button>
                <button type="button" class="table-action" @click="showPartHistory(item.locationId)">更换历史</button>
                <button type="button" class="table-action" @click="openLocationDialog(locationById(item.locationId))">编辑</button>
                <button
                  type="button"
                  class="table-action danger-action"
                  :disabled="deletingLocationId === item.locationId"
                  @click="deleteLocation(item)"
                >
                  {{ deletingLocationId === item.locationId ? '删除中...' : '删除' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-else class="data-section">
      <div class="toolbar history-toolbar">
        <button type="button" class="button secondary" @click="activeView = 'status'">返回当前位置</button>
        <strong class="history-title">{{ selectedHistoryPartId }} · {{ getLocationName(selectedHistoryPartId) }} 更换历史</strong>
        <label class="filter-field history-count">
          <span>返回数量</span>
          <select v-model.number="historyLimit" @change="loadHistory(selectedHistoryPartId)">
            <option :value="50">50 条</option>
            <option :value="100">100 条</option>
            <option :value="200">200 条</option>
            <option :value="500">500 条</option>
          </select>
        </label>
        <span class="result-count">共 {{ historyItems.length }} 条</span>
      </div>

      <div v-if="errorMessage" class="feedback error">{{ errorMessage }}</div>
      <div class="table-wrap history-table">
        <table>
          <thead>
            <tr>
              <th>更换时间</th>
              <th>安装位置</th>
              <th>备件名称 / 类型</th>
              <th>操作人</th>
              <th>备注</th>
              <th>记录创建时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="historyLoading && historyItems.length === 0">
              <td colspan="6" class="empty-cell">正在加载更换历史...</td>
            </tr>
            <tr v-else-if="historyItems.length === 0">
              <td colspan="6" class="empty-cell">暂无更换历史</td>
            </tr>
            <tr v-for="record in historyItems" :key="record.id">
              <td><strong class="primary-value">{{ formatDateTime(record.replacementTime) }}</strong></td>
              <td>
                <strong class="primary-value">{{ record.locationId }}</strong>
                <span class="secondary-value">{{ getLocationName(record.locationId) }}</span>
              </td>
              <td>
                <strong class="primary-value">{{ record.sparePartName }}</strong>
                <span class="secondary-value">{{ record.sparePartType || '--' }}</span>
              </td>
              <td>{{ record.replacedBy || '--' }}</td>
              <td class="remark-cell" :title="record.remark || ''">{{ record.remark || '--' }}</td>
              <td>{{ formatDateTime(record.createdTime) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="replacementDialogVisible" class="dialog-overlay" @click.self="closeReplacementDialog">
      <section class="replacement-dialog" role="dialog" aria-modal="true" aria-labelledby="replacement-title">
        <header class="dialog-header">
          <div>
            <h2 id="replacement-title">更换备件</h2>
            <p>提交后，安装使用时长将从实际更换时间重新计算。</p>
          </div>
          <button type="button" class="close-button" aria-label="关闭" @click="closeReplacementDialog">×</button>
        </header>

        <form @submit.prevent="submitReplacement">
          <div class="form-grid">
            <label>
              <span>安装位置 <em>*</em></span>
              <select v-model="replacementForm.locationId" required @change="applyLocationDefaults">
                <option value="" disabled>请选择安装位置</option>
                <option v-for="location in enabledLocations" :key="location.locationId" :value="location.locationId">
                  {{ location.locationId }} · {{ location.locationName }}
                </option>
              </select>
            </label>
            <label>
              <span>装入备件名称</span>
              <input v-model.trim="replacementForm.sparePartName" maxlength="100" placeholder="例如 IO 板卡" />
            </label>
            <label>
              <span>备件类型</span>
              <input v-model.trim="replacementForm.sparePartType" maxlength="100" placeholder="例如 Reader、IO、Trigger" />
            </label>
            <label>
              <span>实际更换时间</span>
              <input v-model="replacementForm.replacementTime" type="datetime-local" step="1" />
            </label>
            <label>
              <span>操作人</span>
              <input v-model.trim="replacementForm.replacedBy" maxlength="100" />
            </label>
            <label class="full-width">
              <span>备注</span>
              <textarea v-model.trim="replacementForm.remark" rows="3" maxlength="500" placeholder="填写现场更换说明"></textarea>
            </label>
          </div>
          <div v-if="dialogErrorMessage" class="feedback error">{{ dialogErrorMessage }}</div>
          <footer class="dialog-footer">
            <button type="button" class="button secondary" :disabled="submitting" @click="closeReplacementDialog">取消</button>
            <button type="submit" class="button primary" :disabled="submitting">
              {{ submitting ? '提交中...' : '确认更换' }}
            </button>
          </footer>
        </form>
      </section>
    </div>

    <div v-if="locationDialogVisible" class="dialog-overlay" @click.self="closeLocationDialog">
      <section class="replacement-dialog location-dialog" role="dialog" aria-modal="true" aria-labelledby="location-title">
        <header class="dialog-header">
          <div>
            <h2 id="location-title">{{ editingLocationId ? '编辑备件位置' : '添加备件位置' }}</h2>
            <p>安装位置是稳定台账，更换记录将长期归档在该位置下。</p>
          </div>
          <button type="button" class="close-button" aria-label="关闭" @click="closeLocationDialog">×</button>
        </header>
        <form @submit.prevent="submitLocation">
          <div class="form-grid">
            <label>
              <span>位置编号 <em>*</em></span>
              <input v-model.trim="locationForm.locationId" :disabled="Boolean(editingLocationId)" required maxlength="100" placeholder="例如 LINE03-IO-CABINET" />
            </label>
            <label>
              <span>位置名称 <em>*</em></span>
              <input v-model.trim="locationForm.locationName" required maxlength="100" placeholder="例如 LINE03 电柜 IO 板卡位" />
            </label>
            <label>
              <span>允许的备件类型</span>
              <input v-model.trim="locationForm.expectedSparePartType" maxlength="100" placeholder="例如 IO、Reader、Trigger" />
            </label>
            <label class="full-width">
              <span>位置备注</span>
              <textarea v-model.trim="locationForm.remark" rows="3" maxlength="1000" placeholder="填写位置用途或安装要求"></textarea>
            </label>
          </div>
          <div v-if="locationDialogError" class="feedback error">{{ locationDialogError }}</div>
          <footer class="dialog-footer">
            <button type="button" class="button secondary" :disabled="locationSubmitting" @click="closeLocationDialog">取消</button>
            <button type="submit" class="button primary" :disabled="locationSubmitting">
              {{ locationSubmitting ? '保存中...' : '保存位置' }}
            </button>
          </footer>
        </form>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { sparePartLocationApi, sparePartReplacementApi } from '@/api/sparePartReplacement'
import { useAppDialog } from '@/utils/appDialog'
import type {
  RecordSparePartReplacementParams,
  SaveSparePartLocationParams,
  SparePartLocation,
  SparePartReplacementRecord,
  SparePartUsageStatus
} from '@/types/sparePartReplacement'

type DataView = 'status' | 'history'

const activeView = ref<DataView>('status')
const loading = ref(false)
const historyLoading = ref(false)
const submitting = ref(false)
const locationSubmitting = ref(false)
const errorMessage = ref('')
const dialogErrorMessage = ref('')
const locationDialogError = ref('')
const successMessage = ref('')
const statusItems = ref<SparePartUsageStatus[]>([])
const locations = ref<SparePartLocation[]>([])
const historyItems = ref<SparePartReplacementRecord[]>([])
const keyword = ref('')
const historyLimit = ref(100)
const selectedHistoryPartId = ref('')
const replacementDialogVisible = ref(false)
const locationDialogVisible = ref(false)
const editingLocationId = ref('')
const deletingLocationId = ref('')
const appDialog = useAppDialog()

const replacementForm = reactive({
  locationId: '',
  sparePartName: '',
  sparePartType: '',
  replacementTime: '',
  replacedBy: '',
  remark: ''
})

const locationForm = reactive<SaveSparePartLocationParams>({
  locationId: '',
  locationName: '',
  expectedSparePartType: '',
  physicalLocation: '',
  enabled: true,
  remark: ''
})

const enabledLocations = computed(() => locations.value.filter(location => location.enabled))

const normalize = (value: unknown) => String(value ?? '').toLocaleLowerCase('zh-CN')
const locationById = (locationId: string) => locations.value.find(item => item.locationId === locationId)
const getLocationName = (locationId: string) => locationById(locationId)?.locationName || '--'

const filteredStatusItems = computed(() => {
  const query = normalize(keyword.value)
  return statusItems.value.filter(item => {
    const matchesKeyword = !query || [
      item.locationId,
      item.locationName,
      item.physicalLocation,
      item.expectedSparePartType,
      item.sparePartName,
      item.sparePartType,
      item.partNo,
      item.serialNo,
      item.replacedBy
    ].some(value => normalize(value).includes(query))
    return matchesKeyword
  })
})

const formatInputDate = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

const formatDateTime = (value: string | null) => {
  if (!value) return '--'
  const date = new Date(value)
  return Number.isFinite(date.getTime())
    ? date.toLocaleString('zh-CN', { hour12: false })
    : value
}

const formatDays = (days: number | null) => days === null ? '--' : `${days.toFixed(2)} 天`
const formatHours = (hours: number) => `${hours.toFixed(1)} 小时`

const getErrorMessage = (error: unknown, fallback: string) => {
  const responseMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
  return responseMessage || fallback
}

const isDeleteHistoryRequiredError = (error: unknown) => {
  const message = getErrorMessage(error, '').toLocaleLowerCase('zh-CN')
  return message.includes('deletehistory=true') ||
    message.includes('已有流水') ||
    message.includes('更换流水')
}

const showSuccess = (message: string) => {
  successMessage.value = message
  window.setTimeout(() => { successMessage.value = '' }, 5000)
}

const loadStatus = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const [statusResponse, locationResponse, recentHistoryResponse] = await Promise.all([
      sparePartReplacementApi.getAllStatus(),
      sparePartLocationApi.getAll(true),
      sparePartReplacementApi.getHistory({ count: 1000 })
    ])
    locations.value = locationResponse.items || []

    const statusByLocation = new Map(
      (statusResponse.items || []).map(item => [item.locationId, item])
    )
    const latestRecordByLocation = new Map<string, SparePartReplacementRecord>()
    for (const record of recentHistoryResponse.items || []) {
      if (!latestRecordByLocation.has(record.locationId))
        latestRecordByLocation.set(record.locationId, record)
    }

    // 正常情况下全量最近历史已覆盖所有位置；超过 1000 条时补查缺失位置的最新一条。
    const missingLatestIds = (statusResponse.items || [])
      .filter(item => item.hasReplacementRecord && !latestRecordByLocation.has(item.locationId))
      .map(item => item.locationId)
    const missingResponses = await Promise.all(
      missingLatestIds.map(locationId => sparePartReplacementApi.getHistory({ locationId, count: 1 }))
    )
    missingResponses.forEach(response => {
      const record = response.items?.[0]
      if (record) latestRecordByLocation.set(record.locationId, record)
    })

    statusItems.value = locations.value.map(location => {
      const status = statusByLocation.get(location.locationId)
      const latest = latestRecordByLocation.get(location.locationId)
      return {
        workshopId: location.workshopId,
        lineId: location.lineId,
        ipcId: location.ipcId,
        locationId: location.locationId,
        locationName: location.locationName,
        expectedSparePartType: location.expectedSparePartType,
        physicalLocation: location.physicalLocation,
        enabled: location.enabled,
        sparePartName: latest?.sparePartName ?? null,
        sparePartType: latest?.sparePartType ?? null,
        replacementTime: status?.replacementTime ?? latest?.replacementTime ?? null,
        replacedBy: status?.replacedBy ?? latest?.replacedBy ?? null,
        partNo: status?.partNo ?? latest?.partNo ?? null,
        serialNo: status?.serialNo ?? latest?.serialNo ?? null,
        locationRemark: location.remark,
        replacementRemark: latest?.remark ?? null,
        recordCreatedTime: status?.recordCreatedTime ?? latest?.createdTime ?? null,
        installedDays: status?.installedDays ?? null,
        installedHours: status?.installedHours ?? null,
        hasReplacementRecord: Boolean(status?.hasReplacementRecord || latest)
      }
    })
  } catch (error) {
    console.error('查询安装位置状态失败:', error)
    errorMessage.value = getErrorMessage(error, '安装位置状态加载失败，请检查后端服务')
  } finally {
    loading.value = false
  }
}

const loadHistory = async (locationId = '') => {
  historyLoading.value = true
  errorMessage.value = ''
  selectedHistoryPartId.value = locationId
  try {
    const response = await sparePartReplacementApi.getHistory({
      locationId: locationId || undefined,
      count: historyLimit.value
    })
    historyItems.value = response.items || []
  } catch (error) {
    console.error('查询备件更换历史失败:', error)
    errorMessage.value = getErrorMessage(error, '更换历史加载失败，请检查后端服务')
  } finally {
    historyLoading.value = false
  }
}

const refreshCurrentView = () => activeView.value === 'status'
  ? loadStatus()
  : loadHistory(selectedHistoryPartId.value)

const showPartHistory = async (locationId: string) => {
  activeView.value = 'history'
  await loadHistory(locationId)
}

const resetReplacementForm = () => Object.assign(replacementForm, {
  locationId: '',
  sparePartName: '',
  sparePartType: '',
  replacementTime: formatInputDate(new Date()),
  replacedBy: '',
  remark: ''
})

const applyLocationDefaults = () => {
  const location = locationById(replacementForm.locationId)
  if (location && !replacementForm.sparePartType)
    replacementForm.sparePartType = location.expectedSparePartType || ''
}

const openReplacementDialog = (item?: SparePartUsageStatus) => {
  resetReplacementForm()
  if (item) {
    replacementForm.locationId = item.locationId
    replacementForm.sparePartName = item.sparePartName || ''
    replacementForm.sparePartType = item.sparePartType || item.expectedSparePartType || ''
  }
  dialogErrorMessage.value = ''
  replacementDialogVisible.value = true
}

const closeReplacementDialog = () => {
  if (!submitting.value) replacementDialogVisible.value = false
}

const submitReplacement = async () => {
  if (!replacementForm.locationId) {
    dialogErrorMessage.value = '请选择安装位置'
    return
  }

  submitting.value = true
  dialogErrorMessage.value = ''
  const payload = Object.fromEntries(
    Object.entries(replacementForm).filter(([, value]) => value !== '')
  ) as unknown as RecordSparePartReplacementParams

  try {
    const response = await sparePartReplacementApi.recordReplacement(payload)
    replacementDialogVisible.value = false
    showSuccess(response.message || '备件更换记录已保存')
    await Promise.all([
      loadStatus(),
      historyItems.value.length > 0 ? loadHistory(selectedHistoryPartId.value) : Promise.resolve()
    ])
  } catch (error) {
    console.error('登记备件更换失败:', error)
    dialogErrorMessage.value = getErrorMessage(error, '登记失败，请检查填写内容或后端服务')
  } finally {
    submitting.value = false
  }
}

const resetLocationForm = () => Object.assign(locationForm, {
  locationId: '',
  locationName: '',
  expectedSparePartType: '',
  physicalLocation: '',
  enabled: true,
  remark: ''
})

const openLocationDialog = (location?: SparePartLocation) => {
  resetLocationForm()
  editingLocationId.value = location?.locationId || ''
  if (location) {
    Object.assign(locationForm, {
      locationId: location.locationId,
      locationName: location.locationName,
      expectedSparePartType: location.expectedSparePartType || '',
      remark: location.remark || ''
    })
  }
  locationDialogError.value = ''
  locationDialogVisible.value = true
}

const closeLocationDialog = () => {
  if (!locationSubmitting.value) locationDialogVisible.value = false
}

const cleanLocationPayload = () => Object.fromEntries(
  Object.entries(locationForm).filter(([, value]) => value !== '')
) as unknown as SaveSparePartLocationParams

const submitLocation = async () => {
  if (!locationForm.locationId || !locationForm.locationName) {
    locationDialogError.value = '请填写位置编号和位置名称'
    return
  }

  locationSubmitting.value = true
  locationDialogError.value = ''
  try {
    const payload = cleanLocationPayload()
    const response = editingLocationId.value
      ? await sparePartLocationApi.update(editingLocationId.value, payload)
      : await sparePartLocationApi.create(payload)
    locationDialogVisible.value = false
    showSuccess(response.message || '安装位置已保存')
    await loadStatus()
  } catch (error) {
    console.error('保存安装位置失败:', error)
    locationDialogError.value = getErrorMessage(error, '保存失败，请检查填写内容或后端服务')
  } finally {
    locationSubmitting.value = false
  }
}

const confirmDeleteLocationWithHistory = (item: SparePartUsageStatus) => appDialog.confirm({
  title: '确认删除更换流水',
  message: `备件位置「${item.locationId} · ${item.locationName}」已有更换流水。\n\n继续删除会同时删除该位置下的全部备件更换历史记录，删除后无法在系统中恢复。`,
  type: 'danger',
  confirmText: '删除位置和历史',
  cancelText: '取消'
})

const afterLocationDeleted = async (locationId: string) => {
  if (selectedHistoryPartId.value === locationId) {
    selectedHistoryPartId.value = ''
    historyItems.value = []
    activeView.value = 'status'
  }
  await loadStatus()
}

const deleteLocationByMode = async (item: SparePartUsageStatus, deleteHistory: boolean) => {
  const response = await sparePartLocationApi.delete(item.locationId, deleteHistory)
  showSuccess(response.message || (deleteHistory ? '备件位置及更换历史已删除' : '备件位置已删除'))
  await afterLocationDeleted(item.locationId)
}

const deleteLocation = async (item: SparePartUsageStatus) => {
  const confirmed = await appDialog.confirm({
    title: '删除备件位置',
    message: `确认删除备件位置「${item.locationId} · ${item.locationName}」吗？`,
    type: item.hasReplacementRecord ? 'warning' : 'danger',
    confirmText: '删除位置',
    cancelText: '取消'
  })
  if (!confirmed) return

  deletingLocationId.value = item.locationId
  errorMessage.value = ''
  try {
    if (item.hasReplacementRecord) {
      const deleteHistoryConfirmed = await confirmDeleteLocationWithHistory(item)
      if (!deleteHistoryConfirmed) return
      await deleteLocationByMode(item, true)
      return
    }

    await deleteLocationByMode(item, false)
  } catch (error) {
    if (isDeleteHistoryRequiredError(error)) {
      const deleteHistoryConfirmed = await confirmDeleteLocationWithHistory(item)
      if (!deleteHistoryConfirmed) return

      try {
        await deleteLocationByMode(item, true)
        return
      } catch (deleteHistoryError) {
        console.error('删除备件位置及更换历史失败:', deleteHistoryError)
        errorMessage.value = getErrorMessage(deleteHistoryError, '删除失败，请检查后端服务')
        return
      }
    }

    console.error('删除备件位置失败:', error)
    errorMessage.value = getErrorMessage(error, '删除失败，请检查后端服务')
  } finally {
    deletingLocationId.value = ''
  }
}

onMounted(loadStatus)
</script>

<style scoped>
.spare-page {
  width: 100vw;
  height: 100vh;
  overflow-y: auto;
  background: var(--bg-primary);
  color: var(--text-primary);
  padding: 24px 32px 40px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif;
  text-align: left;
  font-size: 17px;
}

.page-header,
.header-actions,
.toolbar,
.dialog-header,
.dialog-footer {
  display: flex;
  align-items: center;
}

.page-header {
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-light);
}

.page-header h1 {
  margin: 0;
  color: var(--text-primary);
  font-size: 32px;
  line-height: 1.2;
  letter-spacing: 0;
}

.page-header p,
.dialog-header p {
  margin-top: 5px;
  color: var(--text-muted);
  font-size: 16px;
}

.header-actions {
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.button {
  min-height: 42px;
  border-radius: 8px;
  padding: 9px 17px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  text-decoration: none;
  transition: var(--transition);
}

.button.primary {
  border: 1px solid var(--primary);
  background: var(--primary);
  color: var(--text-inverse);
}

.button.secondary {
  border: 1px solid var(--border-medium);
  background: var(--bg-card);
  color: var(--text-primary);
}

.button:hover:not(:disabled) { box-shadow: var(--shadow-md); }
.button:disabled { cursor: not-allowed; opacity: 0.6; }

.data-section { padding-top: 16px; }
.toolbar { gap: 16px; margin-bottom: 18px; flex-wrap: wrap; }
.list-actions { display: flex; align-items: flex-end; gap: 8px; }
.add-location-button { min-height: 46px; padding-inline: 24px; font-size: 17px; box-shadow: var(--shadow-md); }
.toolbar label { display: flex; flex-direction: column; gap: 5px; }
.toolbar label > span { color: var(--text-secondary); font-size: 14px; font-weight: 700; }
.search-field { flex: 0 1 520px; width: 520px; min-width: 340px; }
.filter-field { width: 150px; }
.history-count { width: 120px; }

input,
select,
textarea {
  min-height: 44px;
  border: 1px solid var(--border-medium);
  border-radius: 6px;
  background: var(--bg-card);
  color: var(--text-primary);
  padding: 9px 12px;
  font: inherit;
  font-size: 16px;
  outline: none;
}

input:focus,
select:focus,
textarea:focus { border-color: var(--primary); box-shadow: 0 0 0 2px var(--primary-soft); }
textarea { resize: vertical; }
.result-count { margin-left: auto; align-self: flex-end; padding-bottom: 10px; color: var(--text-muted); font-size: 15px; }
.history-title { color: var(--text-primary); font-size: 20px; }

.feedback { margin-bottom: 12px; border-radius: 6px; padding: 9px 12px; font-size: 14px; font-weight: 600; }
.feedback.error { border: 1px solid rgba(220, 53, 69, 0.3); background: rgba(220, 53, 69, 0.08); color: var(--danger); }
.feedback.success { border: 1px solid rgba(45, 106, 79, 0.3); background: rgba(45, 106, 79, 0.08); color: var(--success); }

.table-wrap {
  width: 100%;
  max-height: calc(100vh - 250px);
  overflow: auto;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  background: var(--bg-card);
}

table { width: 100%; min-width: 1180px; border-collapse: collapse; font-size: 16px; }
.history-table table { min-width: 1050px; }
th { position: sticky; top: 0; z-index: 1; background: var(--bg-tertiary); color: var(--text-secondary); text-align: left; font-size: 15px; font-weight: 700; white-space: nowrap; }
th, td { padding: 15px 14px; border-bottom: 1px solid var(--border-light); vertical-align: middle; }
tbody tr:last-child td { border-bottom: 0; }
tbody tr:hover { background: var(--primary-soft); }
.primary-value, .secondary-value { display: block; white-space: nowrap; }
.primary-value { color: var(--text-primary); font-weight: 700; }
.secondary-value { margin-top: 5px; color: var(--text-muted); font-size: 14px; }
.number-cell { text-align: right; }
.duration-days { display: block; color: var(--text-primary); font-size: 18px; }
.actions-cell { text-align: right; white-space: nowrap; }
.empty-cell { height: 160px; color: var(--text-muted); text-align: center; }
.remark-cell { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.status-chip { display: inline-flex; border-radius: 12px; padding: 4px 9px; font-size: 14px; font-weight: 700; white-space: nowrap; }
.status-chip.enabled { background: rgba(45, 106, 79, 0.12); color: var(--success); }
.status-chip.disabled { background: rgba(108, 122, 138, 0.12); color: var(--text-secondary); }
.status-chip.pending { background: rgba(230, 160, 23, 0.12); color: var(--warning); }
.table-action { border: 0; background: transparent; color: var(--text-secondary); padding: 7px 8px; font-size: 15px; font-weight: 700; cursor: pointer; }
.table-action:hover { color: var(--primary); }
.table-action.primary-action { color: var(--primary); }
.table-action.danger-action { color: var(--danger); }
.table-action.danger-action:hover { color: var(--danger); filter: brightness(0.9); }
.table-action:disabled { color: var(--text-muted); cursor: not-allowed; opacity: 0.6; }

.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(5, 12, 20, 0.62);
}

.replacement-dialog {
  width: min(760px, 100%);
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  border: 1px solid var(--border-medium);
  border-radius: 8px;
  background: var(--bg-card);
  box-shadow: var(--shadow-lg);
}

.dialog-header { justify-content: space-between; gap: 16px; padding: 18px 20px; border-bottom: 1px solid var(--border-light); }
.dialog-header h2 { margin: 0; color: var(--text-primary); font-size: 21px; letter-spacing: 0; }
.close-button { width: 36px; height: 36px; border: 0; border-radius: 50%; background: var(--bg-tertiary); color: var(--text-secondary); font-size: 24px; line-height: 1; cursor: pointer; }
.replacement-dialog form { padding: 18px 20px 20px; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.form-grid label { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.form-grid label > span { color: var(--text-secondary); font-size: 13px; font-weight: 700; }
.form-grid em { color: var(--danger); font-style: normal; }
.form-grid .full-width { grid-column: 1 / -1; }
.dialog-footer { justify-content: flex-end; gap: 8px; margin-top: 18px; }

@media (max-width: 900px) {
  .spare-page { padding: 16px; }
  .page-header { align-items: flex-start; flex-direction: column; }
  .header-actions { justify-content: flex-start; }
  .table-wrap { max-height: calc(100vh - 320px); }
}

@media (max-width: 600px) {
  .page-header h1 { font-size: 24px; }
  .list-actions { width: 100%; }
  .list-actions .button { flex: 1; }
  .search-field, .filter-field { width: 100%; min-width: 100%; }
  .result-count { margin-left: 0; }
  .form-grid { grid-template-columns: 1fr; }
  .form-grid .full-width { grid-column: auto; }
}
</style>
