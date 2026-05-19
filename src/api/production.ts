import request from '@/utils/request'
import type { ProductionStatus } from '@/types/production'

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
}