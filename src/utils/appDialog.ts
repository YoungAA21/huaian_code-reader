import { reactive } from 'vue'

export type AppDialogType = 'info' | 'success' | 'warning' | 'danger'

interface DialogOptions {
  title?: string
  message: string
  type?: AppDialogType
  confirmText?: string
  cancelText?: string
  showCancel?: boolean
}

interface DialogState extends Required<DialogOptions> {
  visible: boolean
  resolver: ((value: boolean) => void) | null
}

export const appDialogState = reactive<DialogState>({
  visible: false,
  title: '',
  message: '',
  type: 'info',
  confirmText: '确定',
  cancelText: '取消',
  showCancel: false,
  resolver: null
})

const openDialog = (options: DialogOptions) => new Promise<boolean>((resolve) => {
  appDialogState.visible = true
  appDialogState.title = options.title || '提示'
  appDialogState.message = options.message
  appDialogState.type = options.type || 'info'
  appDialogState.confirmText = options.confirmText || '确定'
  appDialogState.cancelText = options.cancelText || '取消'
  appDialogState.showCancel = Boolean(options.showCancel)
  appDialogState.resolver = resolve
})

export const resolveAppDialog = (value: boolean) => {
  appDialogState.visible = false
  appDialogState.resolver?.(value)
  appDialogState.resolver = null
}

export const useAppDialog = () => ({
  alert: (options: DialogOptions | string) => openDialog(
    typeof options === 'string'
      ? { message: options }
      : options
  ),
  confirm: (options: DialogOptions | string) => openDialog({
    ...(typeof options === 'string' ? { message: options } : options),
    showCancel: true
  })
})
