import {
    HubConnection,
    HubConnectionBuilder,
    HubConnectionState,
    LogLevel
} from '@microsoft/signalr'
import type { ConnectionStatus } from '../types/detection.ts'

type StatusCallback = (status: ConnectionStatus) => void
type EventCallback<T = any> = (data: T) => void

class SignalRService {
    private connection: HubConnection | null = null
    private listeners = new Map<string, EventCallback[]>()
    private statusCallback: StatusCallback | null = null
    private hubUrl = ''
    private connectionOptions: Record<string, any> = {}
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null
    private startPromise: Promise<boolean> | null = null
    private manualStop = false
    private reconnectAttempt = 0

    buildConnection(hubUrl: string, options: Record<string, any> = {}): HubConnection {
        if (this.connection && this.connection.state !== HubConnectionState.Disconnected) {
            return this.connection
        }

        this.hubUrl = hubUrl
        this.connectionOptions = options
        this.manualStop = false

        const connection = new HubConnectionBuilder()
            .withUrl(hubUrl, options)
            .withAutomaticReconnect({
                nextRetryDelayInMilliseconds: (context) =>
                    this.getRetryDelay(context.previousRetryCount)
            })
            .configureLogging(import.meta.env.DEV ? LogLevel.Information : LogLevel.Warning)
            .withKeepAliveInterval(15000)
            .withServerTimeout(60000)
            .build()

        connection.onreconnecting((error) => {
            this.notifyStatusChange({
                isConnected: false,
                status: 'reconnecting',
                message: error?.message || '正在重连...'
            })
        })

        connection.onreconnected(() => {
            this.reconnectAttempt = 0
            this.notifyStatusChange({
                isConnected: true,
                status: 'connected',
                message: '连接成功'
            })
        })

        connection.onclose((error) => {
            this.notifyStatusChange({
                isConnected: false,
                status: 'disconnected',
                message: error?.message || '连接已断开'
            })
            this.scheduleReconnect()
        })

        this.connection = connection
        return connection
    }

    async start(): Promise<boolean> {
        if (!this.connection) {
            throw new Error('请先调用 buildConnection 创建连接')
        }

        if (this.connection.state === HubConnectionState.Connected) {
            return true
        }

        if (this.startPromise) {
            return this.startPromise
        }

        this.manualStop = false
        this.startPromise = this.startConnection()

        try {
            return await this.startPromise
        } finally {
            this.startPromise = null
        }
    }

    private async startConnection(): Promise<boolean> {
        if (!this.connection || this.manualStop) return false
        if (this.connection.state !== HubConnectionState.Disconnected) return false

        try {
            await this.connection.start()
            this.reconnectAttempt = 0
            this.notifyStatusChange({
                isConnected: true,
                status: 'connected',
                message: '连接成功'
            })
            return true
        } catch (error) {
            this.notifyStatusChange({
                isConnected: false,
                status: 'error',
                message: (error as Error).message
            })
            this.scheduleReconnect()
            return false
        }
    }

    private scheduleReconnect(): void {
        if (this.manualStop || !this.connection || this.reconnectTimer) return

        const delay = this.getRetryDelay(this.reconnectAttempt++)
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null
            void this.start()
        }, delay)
    }

    private getRetryDelay(attempt: number): number {
        const delays = [1000, 2000, 5000, 10000, 30000]
        return delays[Math.min(attempt, delays.length - 1)]
    }

    on<T = any>(eventName: string, callback: EventCallback<T>): void {
        if (!this.connection) return

        const callbacks = this.listeners.get(eventName) || []
        if (callbacks.includes(callback as EventCallback)) return

        callbacks.push(callback as EventCallback)
        this.listeners.set(eventName, callbacks)
        this.connection.on(eventName, callback)
    }

    off(eventName: string, callback?: EventCallback): void {
        if (!this.connection) return

        if (callback) {
            this.connection.off(eventName, callback as any)
            const callbacks = this.listeners.get(eventName) || []
            const remaining = callbacks.filter(item => item !== callback)
            if (remaining.length > 0) this.listeners.set(eventName, remaining)
            else this.listeners.delete(eventName)
            return
        }

        this.connection.off(eventName)
        this.listeners.delete(eventName)
    }

    removeAllListeners(): void {
        if (!this.connection) return
        for (const eventName of this.listeners.keys()) {
            this.connection.off(eventName)
        }
        this.listeners.clear()
    }

    async invoke<T = any>(methodName: string, ...args: any[]): Promise<T | null> {
        if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
            return null
        }
        return this.connection.invoke<T>(methodName, ...args)
    }

    send(methodName: string, ...args: any[]): void {
        if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
            return
        }
        void this.connection.send(methodName, ...args)
    }

    private notifyStatusChange(status: ConnectionStatus): void {
        this.statusCallback?.(status)
    }

    onStatusChange(callback: StatusCallback | null): void {
        this.statusCallback = callback
    }

    getConnectionStatus(): boolean {
        return this.connection?.state === HubConnectionState.Connected
    }

    getConnectionId(): string | null {
        return this.connection?.connectionId || null
    }

    async stop(): Promise<void> {
        this.manualStop = true
        this.reconnectAttempt = 0

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer)
            this.reconnectTimer = null
        }

        const connection = this.connection
        if (!connection) return

        this.removeAllListeners()
        if (connection.state !== HubConnectionState.Disconnected) {
            await connection.stop()
        }
        this.connection = null
        this.startPromise = null
        this.notifyStatusChange({
            isConnected: false,
            status: 'disconnected',
            message: '连接已关闭'
        })
    }

    async reconnect(): Promise<boolean> {
        const hubUrl = this.hubUrl
        const options = this.connectionOptions
        await this.stop()
        this.buildConnection(hubUrl, options)
        return this.start()
    }
}

export default new SignalRService()
