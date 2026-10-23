$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Write-Host "启动 LabelING 后端（http://127.0.0.1:8000）..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$root\backend'; uv run uvicorn app.main:create_app --factory --reload --port 8000"
)

Write-Host "启动 LabelING 前端开发服务器（http://127.0.0.1:5173）..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$root\frontend'; npm run dev"
)

Write-Host "已在新窗口启动前后端。开发界面：http://127.0.0.1:5173" -ForegroundColor Green
Write-Host "如果只想运行构建后的版本，请使用 scripts/start.ps1。" -ForegroundColor DarkGray
