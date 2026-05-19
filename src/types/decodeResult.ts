// 解码结果项
export interface DecodeResult {
    id: number
    workshopId: string
    lineId: string
    ipcId: string
    readerId: string
    readerName: string
    receiveTime: string
    receiveType: number
    rawText: string
    codeValue: string
    message: string
    isValidCode: boolean
    isFail: boolean
    isHeartbeat: boolean
    isMultiCode: boolean
    createdTime: string
}

// 最近解码结果响应
export interface RecentDecodeResultsResponse {
    count: number
    items: DecodeResult[]
}

// 查询最近解码结果参数
export interface RecentDecodeResultsParams {
    readerId?: string
    count?: number  // 默认 50
}