import request from '@/utils/request'
import type { ProductionSnapshotsResponse, ProductionStatus } from '@/types/production'

export const productionApi = {
    /**
     * 获取生产状态
     * @returns Promise<ProductionStatus>
     */
    getProductionStatus(): Promise<ProductionStatus> {
        return request({
            url: '/api/production/status',
            method: 'GET',
        })
    },

    getProductionSnapshots(params: {
        startTime: string
        endTime: string
        limit?: number
    }): Promise<ProductionSnapshotsResponse> {
        return request({
            url: '/api/status-snapshots/production',
            method: 'GET',
            params: {
                ...params,
                limit: params.limit ?? 10000,
            },
        })
    },
}
