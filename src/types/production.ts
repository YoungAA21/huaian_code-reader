// 生产状态
export interface ProductionStatus {
    workshopId: string
    lineId: string
    ipcId: string
    runState: number        // 运行状态：0-停止，1-运行，2-暂停等
    speed: number           // 速度
    ioStatusBits: number    // IO状态位
    ioSignals: any[]        // IO信号列表
    emergencyStop: boolean  // 急停状态
    updatedTime: string     // 更新时间
    isProductionRunning: boolean  // 是否正在生产
}

// 运行状态映射
export const RunStateMap: Record<number, { text: string; color: string; icon: string }> = {
    0: { text: '停止', color: 'danger', icon: '⏹️' },
    1: { text: '运行', color: 'success', icon: '▶️' },
    2: { text: '暂停', color: 'warning', icon: '⏸️' },
}