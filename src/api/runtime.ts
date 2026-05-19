import request from '@/utils/request'
import type {
    ReaderRuntime,
    ConfirmRestartParams,
    ConfirmRestartResponse,
    RestartRemindersResponse
} from '@/types/runtime'

export const runtimeApi = {
    /**
     * 获取指定读码器的运行时长信息
     * @param readerId 读码器ID
     * @returns Promise<ReaderRuntime>
     */
    getReaderRuntime(readerId: string): Promise<ReaderRuntime> {
        return request({
            url: `/api/runtime/readers/${readerId}`,
            method: 'GET',
        })
    },

    /**
     * 确认重启读码器（清零运行时间）
     * @param readerId 读码器ID
     * @param params 确认人及备注
     * @returns Promise<ConfirmRestartResponse>
     */
    confirmRestart(readerId: string, params: ConfirmRestartParams): Promise<ConfirmRestartResponse> {
        return request({
            url: `/api/runtime/readers/${readerId}/confirm-restart`,
            method: 'POST',
            data: params,
        })
    },

    /**
     * 获取需要重启提醒的读码器列表
     * @returns Promise<RestartRemindersResponse>
     */
    getRestartReminders(): Promise<RestartRemindersResponse> {
        return request({
            url: '/api/runtime/restart-reminders',
            method: 'GET',
        })
    },
}