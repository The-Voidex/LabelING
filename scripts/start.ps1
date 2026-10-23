$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

Write-Host "构建前端..." -ForegroundColor Cyan
Push-Location "$root\frontend"
try {
  npm run build
} finally {
  Pop-Location
}

Write-Host "启动 LabelING 独立窗口..." -ForegroundColor Green
Write-Host "关闭窗口会收起到系统托盘；右键托盘图标选择「彻底退出」可完全关闭。" -ForegroundColor DarkGray
Push-Location "$root\backend"
try {
  uv run --group desktop python desktop.py
} finally {
  Pop-Location
}
