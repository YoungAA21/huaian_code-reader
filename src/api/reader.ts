import request from '@/utils/request'
import type {
    ReaderSettings,
    ReaderSnapshotsResponse,
    ReaderStatus,
    UpdateReaderMaxTemperatureParams,
} from '@/types/reader'

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

    /**
     * 获取单个读码器配置
     * @param readerId 读码器ID
     * @returns Promise<ReaderSettings>
     */
    getReaderSettings(readerId: string): Promise<ReaderSettings> {
        return request({
            url: `/api/reader-settings/${readerId}`,
            method: 'GET',
        })
    },

    /**
     * 获取单个读码器温度阈值
     * @param readerId 读码器ID
     * @returns Promise<number>
     */
    async getReaderMaxTemperature(readerId: string): Promise<number> {
        const settings = await this.getReaderSettings(readerId)
        return settings.maxTemperature
    },

    /**
     * 修改单个读码器温度阈值
     * @param readerId 读码器ID
     * @param params 温度阈值配置
     * @returns Promise<void>
     */
    updateReaderMaxTemperature(readerId: string, params: UpdateReaderMaxTemperatureParams): Promise<void> {
        return request({
            url: `/api/reader-settings/${readerId}/max-temperature`,
            method: 'PUT',
            data: params,
        })
    },

    getReaderRecentSnapshots(params: {
        readerId: string
        startTime: string
        endTime: string
    }): Promise<ReaderSnapshotsResponse> {
        return request({
            url: '/api/status-snapshots/readers',
            method: 'GET',
            params: {
                ...params,
                limit: 10000,
            },
        })
    },
}
