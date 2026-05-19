import request from '@/utils/request'
import type { Alarm, HistoryAlarmParams, PagedAlarmResponse } from '@/types/alarm'

export const alarmApi = {
    // 获取活跃告警
    getActiveAlarms(): Promise<Alarm[]> {
        return request({
            url: '/api/alarms/active',
            method: 'GET',
        })
    },

    // 获取已恢复告警
    getRecoveredAlarms(): Promise<Alarm[]> {
        return request({
            url: '/api/alarms/recovered',
            method: 'GET',
        })
    },

    // 获取历史告警
    getHistoryAlarms(params: HistoryAlarmParams): Promise<PagedAlarmResponse> {
        return request({
            url: '/api/alarms/history',
            method: 'GET',
            params,
        })
    },
}