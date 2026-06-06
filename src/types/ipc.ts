// 工控机状态
export interface IpcStatus {
    workshopId: string
    lineId: string
    ipcId: string
    time: string
    agentOnline: boolean
    processId: number
    appCpuUsagePercent: number
    appMemoryMb: number
    systemCpuUsagePercent: number
    systemMemoryUsagePercent: number
    appUptimeHours: number
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
    processId: number
    appCpuUsagePercent: number
    appMemoryMb: number
    systemCpuUsagePercent: number
    systemMemoryUsagePercent: number
    appUptimeHours: number
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
