import request from '@/utils/request'
import type { ReaderStatus } from '@/types/reader'

export const readerApi = {
    /**
     * 获取所有读码器实时状态
     * @returns Promise<ReaderStatus[]>
     */
    getReadersStatus(): Promise<ReaderStatus[]> {
        return request({
            url: '/api/readers/status',
            method: 'GET',
        })
    },
}