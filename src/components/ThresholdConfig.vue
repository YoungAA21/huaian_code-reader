<!-- ThresholdConfig.vue - 设备阈值配置弹窗 -->
<template>
  <div v-if="visible" class="threshold-modal-overlay" @click="handleClose">
    <div class="threshold-modal" @click.stop>
      <div class="modal-header">
        <h3>阈值配置 - {{ detector?.name }}</h3>
        <button class="close-btn" @click="handleClose">×</button>
      </div>

      <div class="modal-body">
        <!-- 错误提示区域 -->
        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>

        <div class="config-section">
          <h4>温度阈值 (°C)</h4>
          <div class="slider-group">
            <div class="slider-item">
              <label>危险阈值</label>
              <input
                  type="range"
                  v-model.number="localConfig.tempDanger"
                  min="0"
                  max="100"
                  step="1"
                  :disabled="loadingTemperature"
                  @input="clearError"
              />
              <span class="value">{{ localConfig.tempDanger }} °C</span>
            </div>
            <div v-if="loadingTemperature" class="threshold-hint">
              <span>正在读取温度阈值...</span>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" @click="handleClose">取消</button>
        <button class="btn-primary" @click="handleSave" :disabled="saving || loadingTemperature">
          {{ saving ? '保存中...' : '保存配置' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { readerApi } from '@/api/reader'

const props = defineProps<{
  visible: boolean
  detector: any | null
}>()

const emit = defineEmits<{
  close: []
  save: [detectorId: string, config: ThresholdConfig]
}>()

export interface ThresholdConfig {
  tempDanger: number
}

// 默认阈值
const DEFAULT_CONFIG: ThresholdConfig = {
  tempDanger: 60
}

const localConfig = ref<ThresholdConfig>({ ...DEFAULT_CONFIG })
const errorMessage = ref('')
const loadingTemperature = ref(false)
const saving = ref(false)

// 监听设备变化，加载已有配置
watch(
    () => [props.visible, props.detector] as const,
    async ([visible, newDetector]) => {
      if (!visible || !newDetector) return

      localConfig.value = {
        tempDanger: newDetector.customTempThreshold?.danger ?? DEFAULT_CONFIG.tempDanger
      }
      errorMessage.value = ''

      loadingTemperature.value = false
    },
    { immediate: true }
)

// 兼容旧本地配置
watch(() => props.detector, (newDetector) => {
  if (newDetector && !props.visible) {
    localConfig.value = {
      tempDanger: newDetector.customTempThreshold?.danger ?? DEFAULT_CONFIG.tempDanger
    }
  }
}, { immediate: true })

// 清空错误提示（当用户调整滑块时）
const clearError = () => {
  errorMessage.value = ''
}

// 校验配置
const validateConfig = (): boolean => {

  if (localConfig.value.tempDanger < 0) {
    errorMessage.value = '温度危险阈值不能小于 0'
    return false
  }

  errorMessage.value = ''
  return true
}

const handleClose = () => {
  errorMessage.value = ''
  saving.value = false
  emit('close')
}

const handleSave = async () => {
  if (!props.detector || !validateConfig()) return

  saving.value = true
  try {
    await readerApi.updateReaderMaxTemperature(props.detector.id, {
      maxTemperature: localConfig.value.tempDanger,
      updatedBy: 'web',
      remark: '前端修改温度危险阈值'
    })
    emit('save', props.detector.id, localConfig.value)
    handleClose()
  } catch (error) {
    console.error('保存温度阈值失败:', error)
    errorMessage.value = '保存温度阈值失败，请稍后重试'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
:deep(*) {
  font-size: 16px !important;
}
.threshold-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.threshold-modal {
  background: var(--bg-card);
  border-radius: 16px;
  width: 90%;
  max-width: 500px;
  box-shadow: var(--shadow-lg);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-light);
}

.modal-header h3 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  cursor: pointer;
  color: var(--text-muted);
  padding: 0;
  line-height: 1;
}

.close-btn:hover {
  color: var(--danger);
}

.modal-body {
  padding: 24px;
}

.error-message {
  background: rgba(220, 53, 69, 0.1);
  color: var(--danger);
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  margin-bottom: 20px;
  border-left: 3px solid var(--danger);
}

.config-section {
  margin-bottom: 28px;
}

.config-section h4 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
}

.slider-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.slider-item {
  display: flex;
  align-items: center;
  gap: 16px;
}

.slider-item label {
  width: 80px;
  font-size: 14px;
  color: var(--text-secondary);
}

.slider-item input {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--border-medium);
  -webkit-appearance: none;
}

.slider-item input::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--info);
  cursor: pointer;
}

.slider-item input::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.slider-item .value {
  width: 60px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  font-family: monospace;
}

.threshold-hint {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  margin-top: 8px;
  color: var(--text-muted);
}

.threshold-hint.invalid {
  background: rgba(220, 53, 69, 0.1);
  color: var(--danger);
}

.threshold-hint .current-status {
  font-family: monospace;
  font-size: 11px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--border-light);
}

.btn-secondary, .btn-primary {
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary {
  background: transparent;
  border: 1px solid var(--border-medium);
  color: var(--text-secondary);
}

.btn-secondary:hover {
  background: var(--bg-tertiary);
}

.btn-primary {
  background: var(--info);
  border: none;
  color: white;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}
</style>
