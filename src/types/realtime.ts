import type { Alarm } from './alarm'
import type { IpcStatus } from './ipc'
import type { ProductionStatus } from './production'
import type { ReaderStatus } from './reader'
import type { ReaderRuntime } from './runtime'

export interface ProductionStateRealtime extends ProductionStatus {
    ipc: IpcStatus | null
    readers: ReaderStatus[]
    readerRuntimes: ReaderRuntime[]
    activeAlarms: Alarm[]
}
