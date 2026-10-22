$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

Write-Host "构建前端..." -ForegroundColor Cyan
Push-Location "$root\frontend"
npm run build
Pop-Location

Write-Host "启动 LabelING：http://127.0.0.1:8000" -ForegroundColor Green
Set-Location "$root\backend"
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
