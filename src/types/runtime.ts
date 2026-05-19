// 读码器运行时长信息
export interface ReaderRuntime {
    workshopId: string
    lineId: string
    ipcId: string
    readerId: string
    readerName: string
    enabled: boolean
    accumulatedSeconds: number        // 累计运行秒数
    reminderThresholdSeconds: number   // 提醒阈值秒数
    reminderActive: boolean            // 提醒是否激活
    isAccumulating: boolean            // 是否正在累计
    lastAccumulationTime: string | null
    lastConfirmedTime: string | null   // 最后确认时间
    lastConfirmedBy: string | null     // 最后确认人
    lastConfirmRemark: string | null   // 最后确认备注
    updatedTime: string
    accumulatedHours: number           // 累计运行小时数
    thresholdHours: number             // 阈值小时数
    remainingSeconds: number           // 剩余秒数
}

// 确认重启请求参数
export interface ConfirmRestartParams {
    confirmedBy: string    // 确认人
    remark: string         // 备注
}

// 确认重启响应
export interface ConfirmRestartResponse {
    message: string
    counter: ReaderRuntime
}

// 重启提醒列表响应
export interface RestartRemindersResponse {
    count: number
    readers: ReaderRuntime[]
}