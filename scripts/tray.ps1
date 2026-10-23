param(
  [string]$BaseUrl = "http://127.0.0.1:8000"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path -Parent $PSScriptRoot
$iconPath = Join-Path $PSScriptRoot "labeling.ico"
$dataFallback = Join-Path $repoRoot "data"
$headers = @{ "X-LabelING-Client" = "web" }
$startedAt = Get-Date
$everUp = $false
$exiting = $false

function Test-LabelingServer {
  try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/api/health" -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Stop-LabelingTray {
  if ($script:exiting) { return }
  $script:exiting = $true
  $script:trayTimer.Stop()
  $script:tray.Visible = $false
  $script:tray.Dispose()
  [System.Windows.Forms.Application]::Exit()
}

$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Icon = New-Object System.Drawing.Icon($iconPath)
$tray.Text = "LabelING · 本地服务正在启动"
$tray.Visible = $true

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$menu.ShowImageMargin = $false

$headerItem = New-Object System.Windows.Forms.ToolStripMenuItem("LabelING 本地服务")
$headerItem.Enabled = $false
$headerItem.Font = New-Object System.Drawing.Font($headerItem.Font, [System.Drawing.FontStyle]::Bold)
$statusItem = New-Object System.Windows.Forms.ToolStripMenuItem("正在检查服务…")
$statusItem.Enabled = $false
$openItem = New-Object System.Windows.Forms.ToolStripMenuItem("打开 LabelING")
$folderItem = New-Object System.Windows.Forms.ToolStripMenuItem("打开数据文件夹")
$stopItem = New-Object System.Windows.Forms.ToolStripMenuItem("关闭服务并退出")

$openItem.add_Click({
  Start-Process $BaseUrl
})

$tray.add_MouseDoubleClick({
  Start-Process $BaseUrl
})

$folderItem.add_Click({
  $target = $dataFallback
  try {
    $status = Invoke-RestMethod -Uri "$BaseUrl/api/system/status" -Headers $headers -TimeoutSec 3
    if ($status.data_dir) { $target = $status.data_dir }
  } catch {
  }
  if (Test-Path -LiteralPath $target) {
    Start-Process explorer.exe -ArgumentList "`"$target`""
  } else {
    [System.Windows.Forms.MessageBox]::Show(
      "数据目录不存在：`n$target",
      "LabelING",
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Warning
    ) | Out-Null
  }
})

$stopItem.add_Click({
  $confirm = [System.Windows.Forms.MessageBox]::Show(
    "确定关闭 LabelING 本地服务吗？`n`n关闭后需要重新运行 scripts/start.ps1 才能再次打开。",
    "关闭 LabelING",
    [System.Windows.Forms.MessageBoxButtons]::YesNo,
    [System.Windows.Forms.MessageBoxIcon]::Question,
    [System.Windows.Forms.MessageBoxDefaultButton]::Button2
  )
  if ($confirm -ne [System.Windows.Forms.DialogResult]::Yes) { return }

  $stopItem.Enabled = $false
  $statusItem.Text = "正在关闭…"
  try {
    Invoke-RestMethod -Uri "$BaseUrl/api/system/shutdown" -Method Post -Headers $headers -TimeoutSec 5 | Out-Null
  } catch {
    [System.Windows.Forms.MessageBox]::Show(
      "关闭请求失败，请回到启动服务的窗口按 Ctrl+C。",
      "LabelING",
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Warning
    ) | Out-Null
  }

  $deadline = (Get-Date).AddSeconds(12)
  while ((Get-Date) -lt $deadline -and (Test-LabelingServer)) {
    Start-Sleep -Milliseconds 300
  }
  Stop-LabelingTray
})

[void]$menu.Items.Add($headerItem)
[void]$menu.Items.Add($statusItem)
[void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
[void]$menu.Items.Add($openItem)
[void]$menu.Items.Add($folderItem)
[void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
[void]$menu.Items.Add($stopItem)
$tray.ContextMenuStrip = $menu

$script:trayTimer = New-Object System.Windows.Forms.Timer
$script:trayTimer.Interval = 2500
$script:trayTimer.add_Tick({
  if ($script:exiting) { return }
  $up = Test-LabelingServer
  if ($up) {
    $script:everUp = $true
    $statusItem.Text = "运行中 · $BaseUrl"
    $tray.Text = "LabelING · 本地服务运行中"
    $openItem.Enabled = $true
    $folderItem.Enabled = $true
    $stopItem.Enabled = $true
    return
  }

  $statusItem.Text = "服务已停止"
  $tray.Text = "LabelING · 服务已停止"
  $openItem.Enabled = $false
  $folderItem.Enabled = $true
  $stopItem.Enabled = $false
  $waited = ((Get-Date) - $startedAt).TotalSeconds
  if ($script:everUp -or $waited -gt 30) {
    Stop-LabelingTray
  }
})
$script:trayTimer.Start()

$tray.ShowBalloonTip(
  5000,
  "LabelING 已启动",
  "右键点击托盘图标，可以打开界面、打开数据文件夹或关闭服务。",
  [System.Windows.Forms.ToolTipIcon]::Info
)

try {
  [System.Windows.Forms.Application]::Run()
} finally {
  $script:trayTimer.Stop()
  $tray.Visible = $false
  $tray.Dispose()
  $menu.Dispose()
}
