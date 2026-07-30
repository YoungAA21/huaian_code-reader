// 生产状态
export type RunState = 'Unknown' | 'Stopped' | 'Running' | 'LowSpeed' | 'Fault'

export interface ProductionStatus {
    workshopId: string
    lineId: string
    ipcId: string
    runState: RunState      // 运行状态：Unknown、Stopped、Running、LowSpeed、Fault
    speed: number           // 速度
    ioStatusBits: number    // IO状态位
    ioSignals: boolean[]    // IO信号列表
    emergencyStop: boolean  // 急停状态
    updatedTime: string     // 更新时间
    isProductionRunning: boolean  // 是否正在生产
}

// 运行状态映射
export const RunStateMap: Record<RunState, { text: string; color: string; icon: string }> = {
    Unknown: { text: '未知状态', color: 'idle', icon: '?' },
    Stopped: { text: '停车', color: 'idle', icon: '■' },
    Running: { text: '运行中', color: 'success', icon: '▶' },
    LowSpeed: { text: '慢车', color: 'warning', icon: '◐' },
    Fault: { text: '故障', color: 'danger', icon: '!' },
}

export interface ProductionSnapshot {
    id: number
    workshopId: string
    lineId: string
    ipcId: string
    time: string
    runState: RunState
    speed: number
    ioStatusBits: number
    ioSignals: boolean[]
    emergencyStop: boolean
    isProductionRunning: boolean
    createdTime: string
}

export interface ProductionSnapshotsResponse {
    count: number
    startTime: string | null
    endTime: string | null
    items: ProductionSnapshot[]
}
