// 生产状态
export interface ProductionStatus {
    workshopId: string
    lineId: string
    ipcId: string
    runState: number        // 运行状态：0-未知，1-停车，2-运行中，3-慢车，4-故障
    speed: number           // 速度
    ioStatusBits: number    // IO状态位
    ioSignals: any[]        // IO信号列表
    emergencyStop: boolean  // 急停状态
    updatedTime: string     // 更新时间
    isProductionRunning: boolean  // 是否正在生产
}

// 运行状态映射
export const RunStateMap: Record<number, { text: string; color: string; icon: string }> = {
    0: { text: '未知状态', color: 'idle', icon: '?' },
    1: { text: '停车', color: 'idle', icon: '■' },
    2: { text: '运行中', color: 'success', icon: '▶' },
    3: { text: '慢车', color: 'warning', icon: '◐' },
    4: { text: '故障', color: 'danger', icon: '!' },
}
