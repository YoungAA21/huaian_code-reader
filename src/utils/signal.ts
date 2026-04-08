import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import type { ConnectionStatus } from '../types/detection.ts'

type StatusCallback = (status: ConnectionStatus) => void
type EventCallback<T = any> = (data: T) => void

class SignalRService {
    private connection: HubConnection | null = null
    private isConnected: boolean = false
    private listeners: Map<string, EventCallback[]> = new Map()
    private maxReconnectAttempts: number = 10
    private statusCallback: StatusCallback | null = null
    private hubUrl: string = ''

    // 构建连接
    buildConnection(hubUrl: string, options: Record<string, any> = {}): HubConnection {
        this.hubUrl = hubUrl

        const builder = new HubConnectionBuilder()
            .withUrl(hubUrl, options)
            .withAutomaticReconnect({
                nextRetryDelayInMilliseconds: (retryContext) => {
                    // 自定义重连策略：指数退避
                    if (retryContext.previousRetryCount >= this.maxReconnectAttempts) {
                        return null // 停止重连
                    }

                    const delay = Math.min(30000, Math.pow(2, retryContext.previousRetryCount) * 1000)
                    console.log(`第 ${retryContext.previousRetryCount + 1} 次重连，等待 ${delay}ms`)
                    return delay
                }
            })
            .configureLogging(LogLevel.Information)
            .withKeepAliveInterval(15000) // 15秒心跳
            .build()

        this.connection = builder

        // 监听连接事件
        this.connection.onreconnecting((error) => {
            console.warn('SignalR 正在重连...', error)
            this.isConnected = false
            this.notifyStatusChange({
                isConnected: false,
                status: 'reconnecting',
                message: error?.message || '正在重连...'
            })
        })

        this.connection.onreconnected((connectionId) => {
            console.log('SignalR 重连成功, ID:', connectionId)
            this.isConnected = true
            this.notifyStatusChange({
                isConnected: true,
                status: 'connected',
                message: '连接成功'
            })
        })

        this.connection.onclose((error) => {
            console.warn('SignalR 连接关闭', error)
            this.isConnected = false
            this.notifyStatusChange({
                isConnected: false,
                status: 'disconnected',
                message: error?.message || '连接已断开'
            })
        })

        return this.connection
    }

    // 启动连接
    async start(): Promise<boolean> {
        if (!this.connection) {
            throw new Error('请先调用 buildConnection 创建连接')
        }

        if (this.isConnected) {
            console.log('连接已建立，无需重复启动')
            return true
        }

        try {
            await this.connection.start()
            this.isConnected = true
            console.log('SignalR 连接成功')
            this.notifyStatusChange({
                isConnected: true,
                status: 'connected',
                message: '连接成功'
            })
            return true
        } catch (err) {
            console.error('SignalR 连接失败:', err)
            this.isConnected = false
            this.notifyStatusChange({
                isConnected: false,
                status: 'error',
                message: (err as Error).message
            })
            throw err
        }
    }

    // 注册事件监听
    on<T = any>(eventName: string, callback: EventCallback<T>): void {
        if (!this.connection) {
            console.warn('连接未初始化，无法注册事件:', eventName)
            return
        }

        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, [])
        }
        this.listeners.get(eventName)!.push(callback as EventCallback)
        this.connection.on(eventName, callback)
    }

    // 移除事件监听
    off(eventName: string, callback?: EventCallback): void {
        if (!this.connection) return

        if (callback) {
            this.connection.off(eventName, callback as any)
            const callbacks = this.listeners.get(eventName) || []
            const index = callbacks.indexOf(callback as EventCallback)
            if (index > -1) callbacks.splice(index, 1)
        } else {
            this.connection.off(eventName)
            this.listeners.delete(eventName)
        }
    }

    // 移除所有事件监听
    removeAllListeners(): void {
        if (!this.connection) return

        for (const [eventName] of this.listeners) {
            this.connection.off(eventName)
        }
        this.listeners.clear()
    }

    // 调用服务端方法
    async invoke<T = any>(methodName: string, ...args: any[]): Promise<T | null> {
        if (!this.connection || !this.isConnected) {
            console.warn('连接未建立，无法调用:', methodName)
            return null
        }

        try {
            return await this.connection.invoke<T>(methodName, ...args)
        } catch (err) {
            console.error(`调用 ${methodName} 失败:`, err)
            throw err
        }
    }

    // 发送消息（无返回值）
    send(methodName: string, ...args: any[]): void {
        if (!this.connection || !this.isConnected) {
            console.warn('连接未建立，无法发送:', methodName)
            return
        }

        this.connection.send(methodName, ...args).catch(err => {
            console.error(`发送 ${methodName} 失败:`, err)
        })
    }

    // 状态变化通知
    private notifyStatusChange(status: ConnectionStatus): void {
        if (this.statusCallback) {
            this.statusCallback(status)
        }
    }

    // 设置状态回调
    onStatusChange(callback: StatusCallback): void {
        this.statusCallback = callback
    }

    // 获取连接状态
    getConnectionStatus(): boolean {
        return this.isConnected
    }

    // 获取连接ID
    getConnectionId(): string | null {
        return this.connection?.connectionId || null
    }

    // 关闭连接
    async stop(): Promise<void> {
        if (this.connection) {
            this.removeAllListeners()
            await this.connection.stop()
            this.isConnected = false
            console.log('SignalR 连接已关闭')
            this.notifyStatusChange({
                isConnected: false,
                status: 'disconnected',
                message: '连接已关闭'
            })
        }
    }

    // 重新连接
    async reconnect(): Promise<boolean> {
        await this.stop()
        if (this.hubUrl) {
            this.buildConnection(this.hubUrl)
            return await this.start()
        }
        return false
    }
}

export default new SignalRService()