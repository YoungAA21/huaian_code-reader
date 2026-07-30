<template>
  <Teleport to="body">
    <Transition name="app-dialog-fade">
      <div v-if="state.visible" class="app-dialog-overlay" @click.self="handleCancel">
        <section class="app-dialog" :class="state.type" role="dialog" aria-modal="true">
          <header class="app-dialog-header">
            <span class="dialog-mark">{{ markText }}</span>
            <div>
              <h2>{{ state.title }}</h2>
              <p>{{ typeText }}</p>
            </div>
          </header>

          <div class="app-dialog-body">
            <p>{{ state.message }}</p>
          </div>

          <footer class="app-dialog-footer">
            <button
              v-if="state.showCancel"
              type="button"
              class="dialog-button secondary"
              @click="handleCancel"
            >
              {{ state.cancelText }}
            </button>
            <button type="button" class="dialog-button primary" autofocus @click="handleConfirm">
              {{ state.confirmText }}
            </button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { appDialogState as state, resolveAppDialog } from '@/utils/appDialog'

const markText = computed(() => {
  if (state.type === 'danger') return '!'
  if (state.type === 'warning') return '!'
  if (state.type === 'success') return '✓'
  return 'i'
})

const typeText = computed(() => {
  if (state.type === 'danger') return '高风险操作'
  if (state.type === 'warning') return '操作确认'
  if (state.type === 'success') return '操作完成'
  return '系统提示'
})

const handleConfirm = () => resolveAppDialog(true)
const handleCancel = () => {
  if (state.showCancel) resolveAppDialog(false)
}
</script>

<style scoped>
.app-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px;
  background: rgba(8, 14, 24, 0.62);
  backdrop-filter: blur(5px);
}

.app-dialog {
  width: min(520px, 100%);
  overflow: hidden;
  border: 1px solid var(--border-medium, rgba(148, 163, 184, 0.35));
  border-radius: 8px;
  background: var(--bg-card, #ffffff);
  color: var(--text-primary, #172033);
  box-shadow: var(--shadow-lg, 0 24px 60px rgba(0, 0, 0, 0.24));
}

.app-dialog-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 22px 16px;
  border-bottom: 1px solid var(--border-light, rgba(148, 163, 184, 0.22));
}

.dialog-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 42px;
  height: 42px;
  border-radius: 8px;
  background: var(--primary-soft, rgba(33, 150, 243, 0.12));
  color: var(--primary, #2563eb);
  font-size: 24px;
  font-weight: 800;
  line-height: 1;
}

.app-dialog.warning .dialog-mark {
  background: rgba(230, 160, 23, 0.14);
  color: var(--warning, #e6a017);
}

.app-dialog.danger .dialog-mark {
  background: rgba(220, 53, 69, 0.14);
  color: var(--danger, #dc3545);
}

.app-dialog.success .dialog-mark {
  background: rgba(45, 106, 79, 0.14);
  color: var(--success, #2d6a4f);
}

.app-dialog-header h2 {
  margin: 0;
  color: var(--text-primary, #172033);
  font-size: 22px;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: 0;
}

.app-dialog-header p {
  margin: 5px 0 0;
  color: var(--text-muted, #6b7280);
  font-size: 14px;
}

.app-dialog-body {
  padding: 22px;
}

.app-dialog-body p {
  margin: 0;
  color: var(--text-secondary, #334155);
  font-size: 17px;
  line-height: 1.65;
  white-space: pre-line;
}

.app-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 22px 20px;
  border-top: 1px solid var(--border-light, rgba(148, 163, 184, 0.22));
}

.dialog-button {
  min-width: 92px;
  min-height: 42px;
  border-radius: 8px;
  padding: 9px 18px;
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
  transition: var(--transition, 0.2s ease);
}

.dialog-button.secondary {
  border: 1px solid var(--border-medium, rgba(148, 163, 184, 0.45));
  background: var(--bg-card, #ffffff);
  color: var(--text-secondary, #334155);
}

.dialog-button.primary {
  border: 1px solid var(--primary, #2563eb);
  background: var(--primary, #2563eb);
  color: var(--text-inverse, #ffffff);
}

.app-dialog.danger .dialog-button.primary {
  border-color: var(--danger, #dc3545);
  background: var(--danger, #dc3545);
}

.app-dialog.warning .dialog-button.primary {
  border-color: var(--warning, #e6a017);
  background: var(--warning, #e6a017);
}

.dialog-button:hover {
  box-shadow: var(--shadow-md, 0 10px 20px rgba(0, 0, 0, 0.16));
  transform: translateY(-1px);
}

.dialog-button:focus-visible {
  outline: 2px solid var(--primary, #2563eb);
  outline-offset: 2px;
}

.app-dialog-fade-enter-active,
.app-dialog-fade-leave-active {
  transition: opacity 0.16s ease;
}

.app-dialog-fade-enter-from,
.app-dialog-fade-leave-to {
  opacity: 0;
}

@media (max-width: 600px) {
  .app-dialog-overlay {
    padding: 16px;
  }

  .app-dialog-header,
  .app-dialog-body,
  .app-dialog-footer {
    padding-left: 16px;
    padding-right: 16px;
  }

  .app-dialog-footer {
    flex-direction: column-reverse;
  }

  .dialog-button {
    width: 100%;
  }
}
</style>
