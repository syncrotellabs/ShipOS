param([switch]$Stop, [switch]$InstallShortcut, [string]$NodePath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$appRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$dataRoot = Join-Path $env:LOCALAPPDATA 'ShipOS\Data'
$logRoot = Join-Path $env:LOCALAPPDATA 'ShipOS\Logs'
$localUrl = 'http://127.0.0.1:5174/'
$helperPath = Join-Path $appRoot 'runtime\helper.ps1'
$powershellPath = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
$eventName = 'Local\ShipOS.Stop.' + $env:USERNAME
$mutexName = 'Local\ShipOS.Helper.' + $env:USERNAME
if ($Stop) {
    try { $stopHandle = [Threading.EventWaitHandle]::OpenExisting($eventName); $stopHandle.Set() | Out-Null; $stopHandle.Dispose() } catch {}
    exit
}
$created = $false
$mutex = New-Object Threading.Mutex($true, $mutexName, [ref]$created)
if (-not $created) { Start-Process $localUrl; $mutex.Dispose(); exit }
$stopEvent = New-Object Threading.EventWaitHandle($false, [Threading.EventResetMode]::ManualReset, $eventName)
New-Item -ItemType Directory -Path $dataRoot, $logRoot -Force | Out-Null
$iconPath = Join-Path $logRoot 'shipos.ico'
if (-not (Test-Path -LiteralPath $iconPath)) {
    $bitmap = New-Object Drawing.Bitmap 64,64
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([Drawing.Color]::Transparent)
    $outline = New-Object Drawing.Pen ([Drawing.Color]::FromArgb(139,232,202)),4
    $fill = New-Object Drawing.SolidBrush ([Drawing.Color]::FromArgb(12,36,43))
    $visor = New-Object Drawing.SolidBrush ([Drawing.Color]::FromArgb(232,188,99))
    $graphics.FillEllipse($fill,8,6,48,52)
    $graphics.DrawEllipse($outline,8,6,48,52)
    $graphics.FillRectangle($visor,15,23,35,16)
    $graphics.DrawLine($outline,20,49,44,49)
    $icon = [Drawing.Icon]::FromHandle($bitmap.GetHicon()).Clone()
    $stream = [IO.File]::Create($iconPath)
    $icon.Save($stream); $stream.Dispose(); $icon.Dispose()
    $outline.Dispose(); $fill.Dispose(); $visor.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
function New-ShipOsShortcut([string]$ShortcutPath) {
    $shell = New-Object -ComObject WScript.Shell
    $link = $shell.CreateShortcut($ShortcutPath)
    $link.TargetPath = $powershellPath
    $link.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $helperPath + '"'
    $link.WorkingDirectory = $appRoot
    $link.IconLocation = $iconPath
    $link.Description = 'ShipOS local single-player companion'
    $link.Save()
}
if ($InstallShortcut) { New-ShipOsShortcut (Join-Path ([Environment]::GetFolderPath('Desktop')) 'ShipOS.lnk') }
if (-not $NodePath) {
    $NodePath = Join-Path $appRoot 'runtime\node.exe'
    if (-not (Test-Path -LiteralPath $NodePath)) {
        $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
        if ($nodeCommand) { $NodePath = $nodeCommand.Source }
    }
}
$script:ServerProcess = $null
$script:ShouldRun = $true
$script:Retries = 0
$script:RetryAt = [DateTime]::MinValue
$script:BrowserSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
function Stop-OwnedServer {
    if ($script:ServerProcess -and -not $script:ServerProcess.HasExited) {
        # Only terminate the exact child process this helper started. SQLite WAL recovers cleanly.
        $script:ServerProcess.Kill()
        $script:ServerProcess.WaitForExit(3000) | Out-Null
    }
    $script:ServerProcess = $null
}
function Start-LocalServer {
    if (-not (Test-Path -LiteralPath $NodePath)) { throw 'Bundled Node runtime is missing. Reinstall ShipOS.' }
    foreach ($name in @('service.log','service-error.log')) {
        $log = Join-Path $logRoot $name
        if ((Test-Path -LiteralPath $log) -and (Get-Item -LiteralPath $log).Length -gt 1048576) { Move-Item -LiteralPath $log -Destination ($log + '.previous') -Force }
    }
    $script:ServerProcess = Start-Process -FilePath $NodePath -ArgumentList @('"' + (Join-Path $appRoot 'runtime\server.mjs') + '"') -WorkingDirectory $appRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logRoot 'service.log') -RedirectStandardError (Join-Path $logRoot 'service-error.log') -PassThru
}
function Open-ShipOs([string]$Query = '') { Start-Process ($localUrl + $Query) }
function Add-Menu([string]$Text, [scriptblock]$Action) {
    $item = New-Object Windows.Forms.ToolStripMenuItem $Text
    $item.add_Click($Action)
    $menu.Items.Add($item) | Out-Null
    return $item
}
$tray = New-Object Windows.Forms.NotifyIcon
$tray.Icon = New-Object Drawing.Icon $iconPath
$tray.Text = 'ShipOS local beta'
$menu = New-Object Windows.Forms.ContextMenuStrip
$statusItem = Add-Menu 'Starting local service...' {}; $statusItem.Enabled = $false
[void](Add-Menu 'Open Telemetry' { Open-ShipOs })
[void](Add-Menu 'Open Storytelling' { Open-ShipOs '?page=story' })
[void](Add-Menu 'Show iPad QR code...' { Open-ShipOs '?share=ipad' })
$menu.Items.Add((New-Object Windows.Forms.ToolStripSeparator)) | Out-Null
[void](Add-Menu 'Open data & backups' { Start-Process explorer.exe -ArgumentList ('"' + $dataRoot + '"') })
[void](Add-Menu 'Open diagnostic logs' { Start-Process explorer.exe -ArgumentList ('"' + $logRoot + '"') })
[void](Add-Menu 'Create desktop shortcut' { New-ShipOsShortcut (Join-Path ([Environment]::GetFolderPath('Desktop')) 'ShipOS.lnk') })
$startupItem = Add-Menu 'Start ShipOS when I sign in' {
    $key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
    if ($startupItem.Checked) { Remove-ItemProperty -LiteralPath $key -Name ShipOS -ErrorAction SilentlyContinue; $startupItem.Checked = $false }
    else { New-ItemProperty -Path $key -Name ShipOS -Value ('"' + $powershellPath + '" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $helperPath + '"') -PropertyType String -Force | Out-Null; $startupItem.Checked = $true }
}
$startupItem.Checked = $null -ne [Microsoft.Win32.Registry]::GetValue('HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run', 'ShipOS', $null)
[void](Add-Menu 'Restart local service' { Stop-OwnedServer; $script:Retries = 0; $script:ShouldRun = $true; $script:RetryAt = [DateTime]::MinValue })
[void](Add-Menu 'Stop local service' { $script:ShouldRun = $false; Stop-OwnedServer; $statusItem.Text = 'Stopped'; $tray.Text = 'ShipOS stopped' })
[void](Add-Menu 'Exit ShipOS' { $stopEvent.Set() | Out-Null })
$tray.ContextMenuStrip = $menu
$tray.add_DoubleClick({ Open-ShipOs })
$tray.Visible = $true
$timer = New-Object Windows.Forms.Timer
$timer.Interval = 2500
$timer.add_Tick({
    if ($stopEvent.WaitOne(0)) { [Windows.Forms.Application]::Exit(); return }
    if (-not $script:ShouldRun) { return }
    if (-not $script:ServerProcess -or $script:ServerProcess.HasExited) {
        if ($script:Retries -ge 3) { $statusItem.Text = 'Service failed - open diagnostic logs'; $tray.Text = 'ShipOS needs attention'; return }
        if ([DateTime]::Now -lt $script:RetryAt) { return }
        $script:Retries++
        $script:RetryAt = [DateTime]::Now.AddSeconds(10 * $script:Retries)
        try { Start-LocalServer } catch { $statusItem.Text = $_.Exception.Message; return }
    }
    try {
        Invoke-RestMethod ($localUrl + 'api/session') -WebSession $script:BrowserSession -TimeoutSec 1 | Out-Null
        $health = Invoke-RestMethod ($localUrl + 'api/status') -WebSession $script:BrowserSession -TimeoutSec 1
        $statusItem.Text = if ($health.telemetry.connected) { 'Game connected - local beta' } else { 'Game waiting / stale - local beta' }
        $tray.Text = 'ShipOS: ' + $statusItem.Text
    } catch { $statusItem.Text = 'Connecting to local service...' }
})
try {
    $timer.Start()
    [Windows.Forms.Application]::Run()
} finally {
    $timer.Stop(); $timer.Dispose(); Stop-OwnedServer
    $tray.Visible = $false; $tray.Icon.Dispose(); $tray.Dispose(); $menu.Dispose()
    $stopEvent.Dispose(); $mutex.ReleaseMutex(); $mutex.Dispose()
}
