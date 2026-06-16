export interface Alarm {
    id: string
    workshopId: string
    lineId: string
    ipcId: string
    readerId: string | null
    type: number
    level: number
    message: string
    startTime: string
    updatedTime: string
    endTime: string | null
    isRecovered: boolean
}

export interface HistoryAlarmParams {
    readerId?: string
    alarmType?: number
    alarmLevel?: number
    isRecovered?: boolean
    startTimeFrom?: string
    startTimeTo?: string
    pageIndex?: number
    pageSize?: number
}

export interface PagedAlarmResponse {
    pageIndex: number
    pageSize: number
    total: number
    items: Alarm[]
}
