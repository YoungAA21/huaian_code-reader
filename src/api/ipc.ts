import request from '@/utils/request'
import type { IpcStatus, IpcHistoryResponse, IpcHistoryParams } from '@/types/ipc'

export const ipcApi = {
    /**
     * 获取工控机当前状态
     * @returns Promise<IpcStatus>
     */
    getIpcStatus(): Promise<IpcStatus> {
        return request({
            url: '/api/ipc/status',
            method: 'GET',
        })
    },

    /**
     * 获取工控机历史状态记录
     * @param params 查询参数
     * @param params.count 获取数量，默认20
     * @returns Promise<IpcHistoryResponse>
     */
    getIpcHistory(params?: IpcHistoryParams): Promise<IpcHistoryResponse> {
        return request({
            url: '/api/ipc/history',
            method: 'GET',
            params: {
                count: 20,
                ...params,
            },
        })
    },
}