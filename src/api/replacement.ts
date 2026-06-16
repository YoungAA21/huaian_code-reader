import request from '@/utils/request'
import type {
    ReaderReplacementStatusResponse,
    RecordReaderReplacementParams,
    RecordReaderReplacementResponse
} from '@/types/replacement'

export const replacementApi = {
    getAllStatus(): Promise<ReaderReplacementStatusResponse> {
        return request({
            url: '/api/reader-replacements/status',
            method: 'GET'
        })
    },

    recordReplacement(
        readerId: string,
        params: RecordReaderReplacementParams
    ): Promise<RecordReaderReplacementResponse> {
        return request({
            url: `/api/reader-replacements/readers/${readerId}/replace`,
            method: 'POST',
            data: params
        })
    }
}
