export interface DetectorState {
    id: string
    name: string
    displayValue: number
    lastUpdateTime: string
    lastValue: number
    trend: number
    changeRate: number
    maxValue: number
    minValue: number
    avgValue: number
    isConnected: boolean
    alarms: AlarmItem[]
    trendData: number[]
    valueBuffer: number[]
    lastRenderTime: number
}

export interface AlarmItem {
    id: number
    time: string
    level: 'warning' | 'danger'
    message: string
    value: number
    detectorName?: string
    detectorId?: string
}

export interface ThresholdConfig {
    warning: number
    danger: number
}