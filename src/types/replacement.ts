export interface ReaderReplacementStatus {
    workshopId: string
    lineId: string
    ipcId: string
    readerId: string
    readerName: string
    enabled: boolean
    replacementTime: string | null
    replacedBy: string | null
    partNo: string | null
    serialNo: string | null
    remark: string | null
    recordCreatedTime: string | null
    installedDays: number | null
    installedHours: number | null
    hasReplacementRecord: boolean
}

export interface ReaderReplacementStatusResponse {
    count: number
    items: ReaderReplacementStatus[]
}

export interface RecordReaderReplacementParams {
    replacementTime: string
    replacedBy: string
    partNo?: string
    serialNo?: string
    remark?: string
}

export interface RecordReaderReplacementResponse {
    message: string
    status: ReaderReplacementStatus
}
