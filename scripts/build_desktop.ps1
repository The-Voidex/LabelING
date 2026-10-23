$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

Write-Host "1/3 构建前端..." -ForegroundColor Cyan
Push-Location "$root\frontend"
try {
  npm run build
} finally {
  Pop-Location
}

Write-Host "2/3 安装桌面打包依赖..." -ForegroundColor Cyan
Push-Location "$root\backend"
try {
  uv sync --group desktop
  Write-Host "3/3 打包 Windows 可执行程序..." -ForegroundColor Cyan
  uv run --group desktop pyinstaller "$root\packaging\labeling.spec" --noconfirm --clean --distpath "$root\dist" --workpath "$root\build"
} finally {
  Pop-Location
}

$exe = Join-Path $root "dist\LabelING\LabelING.exe"
if (-not (Test-Path $exe)) {
  throw "打包失败：没有生成 $exe"
}

Write-Host ""
Write-Host "打包完成：$exe" -ForegroundColor Green
Write-Host "运行 scripts/install_desktop.ps1 可安装到本机并创建桌面快捷方式。" -ForegroundColor DarkGray
