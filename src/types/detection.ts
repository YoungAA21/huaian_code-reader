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

// 温度阈值配置接口
export interface TempThresholdConfig {
    warning: number
    danger: number
}

// 检测器/读码器接口（完整版）
export interface Detector {
    // 基础信息
    id: string
    name: string
    device: string
    lineName: string
    stationName: string

    // 状态信息
    status: string
    statusText: string
    isConnected: boolean
    wasOnline: boolean

    // 数值信息
    displayValue: number
    lastValue: number
    trend: number
    changeRate: number
    maxValue: number
    minValue: number
    avgValue: number

    // 温度
    temperature: number
    lastTempWarning: boolean

    // 时间相关
    lastHeartbeat: string | null
    lastUpdateTime: string
    lastValidCodeTime?: string | null
    lastReceiveTime?: string | null
    tcpConnectedTime?: string | null
    lastBusinessResultTime?: string | null
    updatedTime?: string

    // 计数相关
    lastTriggerIndex: number
    lastTotalTime: number
    recentIntervalCount?: number
    lastValidCodeIntervalMs?: number
    recentAverageValidCodeIntervalMs?: number

    // 码值相关
    lastCode: string
    lastRawText?: string | null
    lastReceiveType?: number

    // 网络连接信息
    ip?: string
    tcpPort?: number
    tcpConnected?: boolean
    pingOk?: boolean
    modbusOk?: boolean
    enabled?: boolean

    // 重连信息
    lastReconnectRequestTime?: string | null
    reconnectRequested?: boolean
    reconnectReason?: string | null
    reconnectRequestedTime?: string | null

    // 其他
    message?: string
    status_code?: number
    workshopId?: string
    lineId?: string
    ipcId?: string
    readerName?: string

    // 运行时信息
    runtimeHours?: number
    accumulatedSeconds?: number
    remainingSeconds?: number
    reminderActive?: boolean
    thresholdHours?: number
    reminderThresholdSeconds?: number
    isAccumulating?: boolean
    runtimeUpdatedTime?: string

    // 告警和趋势
    alarms: AlarmRecord[]
    trendData: number[]
    valueBuffer: number[]
    lastRenderTime: number

    // 自定义阈值（可选）
    customThreshold?: ThresholdConfig
    customTempThreshold?: TempThresholdConfig

    // 原始数据
    rawReader?: any
}
