$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$baseUrl = "http://127.0.0.1:8000"

function Test-LabelingHealth {
  try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/health" -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Start-LabelingTray {
  $existing = Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*tray.ps1*" }
  if ($existing) { return }

  Start-Process -FilePath "powershell.exe" -WindowStyle Hidden -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    "`"$root\scripts\tray.ps1`""
  )
}

if (Test-LabelingHealth) {
  Write-Host "LabelING 已在运行：$baseUrl" -ForegroundColor Green
  Start-LabelingTray
  Start-Process $baseUrl
  exit 0
}

Write-Host "构建前端..." -ForegroundColor Cyan
Push-Location "$root\frontend"
npm run build
Pop-Location

Write-Host "启动 LabelING：$baseUrl" -ForegroundColor Green
Write-Host "关闭方式：右键点击任务栏托盘中的 LabelING 图标，选择「关闭服务并退出」。" -ForegroundColor DarkGray
Start-LabelingTray
Set-Location "$root\backend"
uv run python -m app.server
