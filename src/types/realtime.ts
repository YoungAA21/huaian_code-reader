import type { Alarm } from './alarm'
import type { IpcStatus } from './ipc'
import type { ProductionStatus } from './production'
import type { ReaderStatus } from './reader'
import type { ReaderRuntime } from './runtime'

export interface ReaderTriggerIoStatus {
    readerId: string
    ioBitIndex: number
    edgeType: string
    expectedValidCountPerCycle?: number
    lateResultLookbackCycles?: number
    healthStatus: 'Healthy' | 'Warning' | 'Critical' | string
    healthReasons: string[]
    isSuccessRateLow: boolean
    isEffectiveSuccessRateLow?: boolean
    isDelayHigh: boolean
    isConsecutiveNoResultHigh: boolean
    isConsecutiveBadCycleHigh: boolean
    currentValue: boolean
    risingEdgeCount: number
    fallingEdgeCount: number
    anyEdgeCount: number
    lastRisingEdgeTime: string | null
    lastFallingEdgeTime: string | null
    lastAnyEdgeTime: string | null
    lastRisingIntervalMs: number | null
    lastFallingIntervalMs: number | null
    lastAnyEdgeIntervalMs: number | null
    lastTriggerTime: string | null
    triggerCount: number
    settledCycleCount: number
    lastIntervalMs: number | null
    lastSampleTime: string | null
    lastReceiveTime: string | null
    activeCycleStartTime: string | null
    lastSettledCycleStartTime: string | null
    lastCycleStatus: string
    lastBadCycleStatus: string
    lastSuccessCycleStartTime: string | null
    lastSuccessReceiveTime: string | null
    lastSuccessDelayMs: number | null
    pendingTriggerCount: number
    matchedCount: number
    successCycleCount: number
    noResultCount: number
    noReadCycleCount: number
    decodeFailCycleCount: number
    multiCodeCycleCount: number
    failResultCount: number
    noReadResultCount: number
    consecutiveNoResultCount: number
    consecutiveBadCycleCount: number
    successRate: number
    effectiveSuccessRate?: number
    lateRecoveredRate?: number
    lateRecoveredCount?: number
    pendingNoResultCount?: number
    lastLateOffsetCycles?: number | null
    lastReceiveIntervalMs: number | null
}

export interface ReaderIntervalRealtimeDto {
    readerId: string
    name: string
    enabled: boolean
    tcpConnected: boolean
    pingOk: boolean
    modbusOk: boolean
    status: string
    message: string
    lastReceiveTime: string | null
    lastBusinessResultTime: string | null
    lastValidCodeTime: string | null
    lastReceiveType: string
    lastValidCodeIntervalMs: number | null
    recentAverageValidCodeIntervalMs: number | null
    recentIntervalCount: number
    currentTemperature: number | null
    accumulatedHours: number | null
    runtimeThresholdHours: number | null
    runtimeRemainingSeconds: number | null
    runtimeReminderActive: boolean | null
    runtimeIsAccumulating: boolean | null
    runtimeLastConfirmedTime: string | null
    updatedTime: string
}

export interface ProductionStateRealtime extends ProductionStatus {
    ipc: IpcStatus | null
    readers?: ReaderStatus[]
    readerIntervals?: ReaderIntervalRealtimeDto[]
    readerRuntimes?: ReaderRuntime[]
    activeAlarms?: Alarm[]
    triggerCycles?: ReaderTriggerIoStatus[]
    manualTriggerAckToggle?: boolean | null
    manualTriggerAckUpdatedTime?: string | null
}
