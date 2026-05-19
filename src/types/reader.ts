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
    status: number  // 1-正常, 2-警告, 3-异常等
    message: string
    updatedTime: string
}

// 读码器状态映射
export const ReaderStatusMap: Record<number, { text: string; color: string; icon: string }> = {
    0: { text: '离线', color: 'danger', icon: '🔴' },
    1: { text: '在线', color: 'success', icon: '🟢' },
    2: { text: '警告', color: 'warning', icon: '⚠️' },
    3: { text: '异常', color: 'danger', icon: '🔴' },
}