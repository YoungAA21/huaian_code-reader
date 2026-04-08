@echo off
chcp 65001
title 卷包车间检测监控中心

echo ====================================
echo    卷包车间检测监控中心
echo    后端地址: 169.254.173.199:8989
echo ====================================
echo.

echo [1/3] 检查依赖...
if not exist "node_modules" (
    echo 正在安装依赖，请稍候...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo 错误：依赖安装失败！
        pause
        exit /b 1
    )
) else (
    echo 依赖已存在，跳过安装
)

echo.
echo [2/3] 构建项目中...
call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo 错误：项目构建失败！
    pause
    exit /b 1
)

echo.
echo [3/3] 启动预览服务器...
echo.
echo ========== 访问地址 ==========
echo  本地访问: http://localhost:4173
echo ==============================
echo.
echo SignalR代理配置:
echo   /hubs/device -> http://169.254.173.199:8989
echo.
echo 按 Ctrl+C 停止服务器
echo ====================================
echo.

npx vite preview --host 0.0.0.0 --port 4173

pause