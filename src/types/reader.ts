// 读码器实时状态
export interface ReaderStatus {
    readerId: string
    name: string
    ip: string
    tcpPort: number
    enabled: boolean
    tcpConnected: boolean
    tcpConnectedTime: string | null
    lastReconnectRequestTime: string | null
    pingOk: boolean
    modbusOk: boolean
    reconnectRequested: boolean
    reconnectReason: string | null
    reconnectRequestedTime: string | null
    lastReceiveTime: string | null
    lastBusinessResultTime: string | null
    lastValidCodeTime: string | null
    lastHeartbeatTime: string | null
    lastReceiveType: number
    lastRawText: string | null
    lastValidCodeIntervalMs: number
    recentAverageValidCodeIntervalMs: number
    recentIntervalCount: number
    currentTemperature: number
    status: number  // 0-未知，1-离线，2-连接中，3-在线，4-警告，5-故障，6-维护
    message: string
    updatedTime: string
}

// 读码器配置
export interface ReaderSettings {
    readerId: string
    name: string
    enabled: boolean
    ip: string
    tcpPort: number
    hasHeartbeat: boolean
    heartbeatTimeoutSeconds: number
    noResultTimeoutMs: number
    maxIntervalMs: number
    intervalFluctuationRatio: number
    maxTemperature: number
    runtimeReminderEnabled: boolean
    runtimeReminderHours: number
}

export interface UpdateReaderMaxTemperatureParams {
    maxTemperature: number
    updatedBy: string
    remark: string
}

// 读码器状态映射
export const ReaderStatusMap: Record<number, { text: string; color: string; icon: string }> = {
    0: { text: '未知', color: 'unknown', icon: '?' },
    1: { text: '离线', color: 'offline', icon: '■' },
    2: { text: '连接中', color: 'connecting', icon: '...' },
    3: { text: '在线', color: 'online', icon: '●' },
    4: { text: '警告', color: 'warning', icon: '!' },
    5: { text: '故障', color: 'fault', icon: '!' },
    6: { text: '维护', color: 'maintenance', icon: '◇' },
}
