param(
  [switch]$MigrateData
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root "dist\LabelING"
$exeSource = Join-Path $source "LabelING.exe"
$installDir = Join-Path $env:LOCALAPPDATA "Programs\LabelING"
$exe = Join-Path $installDir "LabelING.exe"

if (-not (Test-Path $exeSource)) {
  throw "没有找到打包结果，请先运行 scripts/build_desktop.ps1。"
}

$running = Get-Process -Name "LabelING" -ErrorAction SilentlyContinue
if ($running) {
  throw "LabelING 正在运行，请先从托盘图标选择「彻底退出」，再重新安装。"
}

Write-Host "安装到：$installDir" -ForegroundColor Cyan
if (Test-Path $installDir) {
  Remove-Item -LiteralPath $installDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $installDir | Out-Null
Copy-Item -Path (Join-Path $source "*") -Destination $installDir -Recurse -Force

if ($MigrateData) {
  $sourceData = Join-Path $root "data"
  $targetData = Join-Path $env:LOCALAPPDATA "LabelING"
  $targetDb = Join-Path $targetData "labeling.db"
  if (Test-Path $targetDb) {
    Write-Host "检测到已有本机数据，跳过数据迁移：$targetData" -ForegroundColor DarkGray
  } elseif (Test-Path $sourceData) {
    Write-Host "迁移现有数据到：$targetData" -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path $targetData | Out-Null
    Copy-Item -Path (Join-Path $sourceData "*") -Destination $targetData -Recurse -Force
  }
}

function New-LabelingShortcut {
  param([string]$Directory)

  $shortcutPath = Join-Path $Directory "LabelING.lnk"
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $exe
  $shortcut.WorkingDirectory = $installDir
  $shortcut.IconLocation = "$exe,0"
  $shortcut.Description = "LabelING 本地图像标注"
  $shortcut.Save()
  return $shortcutPath
}

$desktop = [Environment]::GetFolderPath("Desktop")
$startMenu = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
New-Item -ItemType Directory -Force -Path $startMenu | Out-Null

$desktopShortcut = New-LabelingShortcut -Directory $desktop
$startShortcut = New-LabelingShortcut -Directory $startMenu

Write-Host ""
Write-Host "安装完成。" -ForegroundColor Green
Write-Host "桌面快捷方式：$desktopShortcut"
Write-Host "开始菜单快捷方式：$startShortcut"
Write-Host "数据目录：$env:LOCALAPPDATA\LabelING" -ForegroundColor DarkGray
