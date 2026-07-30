export type ManualTriggerBatchStatusValue =
    1 | 2 | 3 | 4 | 5 |
    'CommandSent' |
    'WaitingReaderResults' |
    'Completed' |
    'Timeout' |
    'Failed'

export type ManualTriggerResultStatusValue =
    1 | 2 | 3 | 4 | 5 | 6 |
    'Waiting' |
    'ValidCode' |
    'NoRead' |
    'DecodeFail' |
    'ReaderTimeout' |
    'TriggerCommandTimeout'

export interface StartManualTriggerRequest {
    requestedBy?: string
    remark?: string
}

export interface StartManualTriggerResponse {
    accepted: boolean
    batchId: string
    status: ManualTriggerBatchStatusValue
    ackBeforeValue: boolean | null
    serialCommandText: string
    message: string
}

export interface ManualTriggerBatch {
    id: number
    batchId: string
    workshopId: string
    lineId: string
    ipcId: string
    triggerTime: string
    status: ManualTriggerBatchStatusValue
    speed: number
    runState: string
    requestedBy: string
    remark: string | null
    serialCommandText: string
    serialCommandSentTime: string | null
    ackMode: string
    ackBeforeValue: boolean | null
    ackValue: boolean | null
    serialAckTime: string | null
    serialAckOk: boolean
    serialAckMessage: string | null
    expectedReaderCount: number
    receivedReaderCount: number
    serialAckTimeoutMs: number
    readerResultTimeoutMs: number
    completedTime: string | null
    errorMessage: string | null
    createdTime: string
}

export interface ManualTriggerResult {
    id: number
    batchId: string
    workshopId: string
    lineId: string
    ipcId: string
    readerId: string
    readerName: string
    resultStatus: ManualTriggerResultStatusValue
    receiveType: string
    receiveTime: string | null
    rawText: string
    codeValue: string | null
    elapsedMs: number | null
    message: string
    createdTime: string
}

export interface ManualTriggerResultsResponse {
    batchId: string
    count: number
    items: ManualTriggerResult[]
}
