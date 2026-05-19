import request from '@/utils/request'
import type { RecentDecodeResultsResponse, RecentDecodeResultsParams } from '@/types/decodeResult'

export const decodeResultApi = {
    /**
     * 获取最近的解码记录
     * @param params 查询参数
     * @param params.readerId 读码器ID（可选）
     * @param params.count 获取数量，默认50
     * @returns Promise<RecentDecodeResultsResponse>
     */
    getRecentDecodeResults(params?: RecentDecodeResultsParams): Promise<RecentDecodeResultsResponse> {
        return request({
            url: '/api/decode-results/recent',
            method: 'GET',
            params: {
                count: 50,
                ...params,
            },
        })
    },
}