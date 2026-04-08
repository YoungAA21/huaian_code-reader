// 检测数据接口
export interface DetectionData {
    value: number
    timestamp?: string
    deviceId?: string
    status?: 'normal' | 'warning' | 'danger'
}

// 报警记录接口
export interface AlarmRecord {
    id: number
    time: string
    level: 'warning' | 'danger'
    message: string
    value: number
}

// 统计信息接口
export interface Statistics {
    max: number
    min: number
    avg: number
    count: number
}

// 连接状态接口
export interface ConnectionStatus {
    isConnected: boolean
    status: 'connected' | 'disconnected' | 'reconnecting' | 'error'
    message?: string
}

// 阈值配置接口
export interface ThresholdConfig {
    warning: number
    danger: number
}