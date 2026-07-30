import request from '@/utils/request'
import type {
    ManualTriggerBatch,
    ManualTriggerResultsResponse,
    StartManualTriggerRequest,
    StartManualTriggerResponse,
} from '@/types/manualTrigger'

export const manualTriggerApi = {
    startAllReaders(params: StartManualTriggerRequest): Promise<StartManualTriggerResponse> {
        return request({
            url: '/api/manual-trigger/readers/all',
            method: 'POST',
            data: params,
        })
    },

    getBatch(batchId: string): Promise<ManualTriggerBatch> {
        return request({
            url: `/api/manual-trigger/batches/${encodeURIComponent(batchId)}`,
            method: 'GET',
        })
    },

    getResults(batchId: string): Promise<ManualTriggerResultsResponse> {
        return request({
            url: `/api/manual-trigger/batches/${encodeURIComponent(batchId)}/results`,
            method: 'GET',
        })
    },
}
