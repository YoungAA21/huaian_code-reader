// 工控机状态
export interface IpcStatus {
    workshopId: string
    lineId: string
    ipcId: string
    time: string
    agentOnline: boolean
    machineName: string
    osDescription: string
    processorCount: number
    processId: number
    processName: string
    appCpuUsagePercent: number
    appMemoryMb: number
    appPrivateMemoryMb: number
    systemCpuUsagePercent: number
    systemMemoryUsagePercent: number
    systemAvailableMemoryMb: number
    systemTotalMemoryMb: number
    appUptimeHours: number
    systemUptimeHours: number
    diskPath: string
    diskFreeGb: number
    diskTotalGb: number
    diskUsagePercent: number
    localDatabaseOk: boolean
    healthStatus: number
    message: string
}

// 工控机历史记录项
export interface IpcHistoryItem {
    workshopId: string
    lineId: string
    ipcId: string
    time: string
    agentOnline: boolean
    machineName: string
    osDescription: string
    processorCount: number
    processId: number
    processName: string
    appCpuUsagePercent: number
    appMemoryMb: number
    appPrivateMemoryMb: number
    systemCpuUsagePercent: number
    systemMemoryUsagePercent: number
    systemAvailableMemoryMb: number
    systemTotalMemoryMb: number
    appUptimeHours: number
    systemUptimeHours: number
    diskPath: string
    diskFreeGb: number
    diskTotalGb: number
    diskUsagePercent: number
    localDatabaseOk: boolean
    healthStatus: number
    message: string
}

// 工控机历史记录响应
export interface IpcHistoryResponse {
    count: number
    items: IpcHistoryItem[]
}

// 查询工控机历史参数
export interface IpcHistoryParams {
    count?: number  // 获取数量，默认20
}
