# 读码器状态监测移动端

独立于原有 `code-reader` Web 大屏的移动端项目，提供：

- 读码器实时状态
- 当前告警信息
- 全部读码器一键自检

## 后端配置

复制 `.env.example` 为 `.env.local`。与现有后端通过同一域名反向代理时保持相对地址；独立部署或打包 APK 时配置完整 HTTPS 地址。

```env
VITE_API_BASE_URL=https://reader.example.com
VITE_SIGNALR_HUB_URL=https://reader.example.com/hubs/production-state
```

项目使用现有接口：

本地开发代理默认连接 `http://127.0.0.1:5158`。部署到 PDA 时不能使用 `127.0.0.1`，需要在 `.env.local` 中配置运行后端电脑的局域网地址或正式 HTTPS 域名。

- `GET /api/readers/status`
- `GET /api/alarms/active`
- `GET /api/production/status`
- `POST /api/manual-trigger/readers/all`
- `GET /api/manual-trigger/batches/{batchId}`
- `GET /api/manual-trigger/batches/{batchId}/results`
- SignalR `/hubs/production-state`

## 本地运行

需要 Node.js 22.13 或更高版本。

```bash
npm install
npm run dev
```

访问 `/?demo=1` 可以在未连接现场后端时查看演示数据和完整自检交互。

## 构建

```bash
npm run build
```

部署时需要让页面、`/api` 和 `/hubs` 使用同一个 HTTPS 域名；如果使用不同域名，需要在后端配置 CORS、凭据和 WebSocket 访问来源。

## PDA Android 工程

项目使用 Capacitor 复用同一套页面。首次生成 Android 工程后，后续每次更新页面运行同步命令：

```bash
npm run android:sync
npm run android:open
```

然后在 Android Studio 中生成 APK。独立 APK 必须在构建前通过 `.env.local` 配置可由 PDA 访问的 HTTPS 后端地址。
