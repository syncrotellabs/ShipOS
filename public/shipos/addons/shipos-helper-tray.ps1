param(
    [switch]$InstallShortcut,
    [switch]$NoStart,
    [ValidateSet("LocalMod", "Bridge")]
    [string]$Mode = "LocalMod"
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName Microsoft.VisualBasic

$appName = "ShipOS Telemetry Helper"
$helperVersion = "2026.09.03.1"
$installRoot = Join-Path $env:LOCALAPPDATA "ShipOS\Helper"
$installedScript = Join-Path $installRoot "shipos-helper-tray.ps1"
$bridgeScript = Join-Path $installRoot "shipos-telemetry-bridge.mjs"
$iconPath = Join-Path $installRoot "shipos-helper-helmet.ico"
$logPath = Join-Path $installRoot "shipos-telemetry-log.jsonl"
$configPath = Join-Path $installRoot "shipos-helper.json"
$localEndpoint = "http://127.0.0.1:8795/telemetry/latest"
$healthEndpoint = "http://127.0.0.1:8795/health"
$localShipOsUrl = "http://127.0.0.1:5174/"
$relayEndpoint = "https://gaming.echoboardhq.com/api/shipos/telemetry/latest"
$remotePushEndpoint = "https://gaming.echoboardhq.com/api/shipos/telemetry"
$sourceBridgeUrl = "https://gaming.echoboardhq.com/shipos/addons/shipos-telemetry-bridge.mjs"
$script:BridgeProcess = $null
$script:NotifyIcon = $null
$script:RelayStatusMenuItem = $null
$script:IpadStatusMenuItem = $null
$script:ShouldRunBridge = -not $NoStart
$script:LastStatus = "Starting"
$script:RelayKey = ""

function Update-RelayMenuStatus {
    if (-not $script:RelayStatusMenuItem) { return }
    $script:RelayStatusMenuItem.Text = if ([string]::IsNullOrWhiteSpace($script:RelayKey)) {
        "EchoBoard relay: not paired"
    }
    else {
        "EchoBoard relay: paired"
    }
}

function Ensure-InstallRoot {
    if (-not (Test-Path -LiteralPath $installRoot)) {
        New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
    }
}

function Load-HelperConfig {
    $script:RelayKey = ""
    if (-not (Test-Path -LiteralPath $configPath)) {
        Update-RelayMenuStatus
        return
    }
    try {
        $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
        if ($config.relayKey) { $script:RelayKey = [string]$config.relayKey }
    }
    catch {
        Show-HelperBalloon "The helper configuration could not be read. Pair the relay again." ([System.Windows.Forms.ToolTipIcon]::Warning)
    }
    Update-RelayMenuStatus
}

function Save-RelayKey {
    param([Parameter(Mandatory = $true)][string]$RelayKey)
    Ensure-InstallRoot
    @{ relayKey = $RelayKey.Trim() } | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding UTF8
    $script:RelayKey = $RelayKey.Trim()
    Update-RelayMenuStatus
}

function Configure-RelayKey {
    $key = [Microsoft.VisualBasic.Interaction]::InputBox(
        "Paste the relay key created in ShipOS. It is stored only in your local helper folder.",
        "Pair EchoBoard Relay",
        $script:RelayKey
    )
    if ([string]::IsNullOrWhiteSpace($key)) { return }
    if (-not $key.Trim().StartsWith("shipos_")) {
        Show-HelperBalloon "That does not look like a ShipOS relay key." ([System.Windows.Forms.ToolTipIcon]::Warning)
        return
    }
    Save-RelayKey -RelayKey $key
    Restart-Bridge
    Show-HelperBalloon "EchoBoard relay paired. The bridge is restarting with the new key."
}

function Copy-SelfToInstallRoot {
    Ensure-InstallRoot
    $currentScript = $PSCommandPath
    if (-not $currentScript) { return }

    $currentFull = [IO.Path]::GetFullPath($currentScript)
    $installedFull = [IO.Path]::GetFullPath($installedScript)
    if (-not [string]::Equals($currentFull, $installedFull, [StringComparison]::OrdinalIgnoreCase)) {
        Copy-Item -LiteralPath $currentFull -Destination $installedScript -Force
    }

    $sourceBridge = Join-Path (Split-Path -Parent $currentFull) "shipos-telemetry-bridge.mjs"
    if (Test-Path -LiteralPath $sourceBridge) {
        $sourceBridgeFull = [IO.Path]::GetFullPath($sourceBridge)
        $bridgeScriptFull = [IO.Path]::GetFullPath($bridgeScript)
        if (-not [string]::Equals($sourceBridgeFull, $bridgeScriptFull, [StringComparison]::OrdinalIgnoreCase)) {
            Copy-Item -LiteralPath $sourceBridgeFull -Destination $bridgeScriptFull -Force
        }
    }
}

function Ensure-BridgeScript {
    if (Test-Path -LiteralPath $bridgeScript) { return }
    Ensure-InstallRoot
    Invoke-WebRequest -UseBasicParsing -Uri $sourceBridgeUrl -OutFile $bridgeScript
}

function New-HelmetIcon {
    param([Parameter(Mandatory = $true)][string]$Path)

    Add-Type -AssemblyName System.Drawing
    Ensure-InstallRoot

    $bitmap = New-Object System.Drawing.Bitmap 64, 64
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.Color]::Transparent)

    $glowPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(150, 99, 255, 232)), 5
    $helmetPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 123, 255, 236)), 3
    $darkBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 7, 23, 29))
    $visorBounds = New-Object System.Drawing.Rectangle -ArgumentList 15, 24, 35, 17
    $visorBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $visorBounds,
        [System.Drawing.Color]::FromArgb(255, 245, 191, 83),
        [System.Drawing.Color]::FromArgb(255, 64, 201, 232),
        0
    )
    $shadowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(160, 0, 0, 0))
    $antennaPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 245, 191, 83)), 2

    $graphics.FillEllipse($shadowBrush, 10, 12, 46, 46)
    $graphics.DrawEllipse($glowPen, 8, 7, 48, 50)
    $graphics.FillEllipse($darkBrush, 10, 8, 44, 48)
    $graphics.DrawEllipse($helmetPen, 10, 8, 44, 48)
    $graphics.FillPie($visorBrush, 14, 20, 38, 25, 185, 170)
    $graphics.DrawArc($helmetPen, 14, 20, 38, 25, 185, 170)
    $graphics.DrawLine($antennaPen, 43, 12, 55, 3)
    $graphics.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 231, 132))), 53, 1, 6, 6)
    $graphics.DrawLine($helmetPen, 18, 49, 46, 49)

    $stream = [IO.File]::Create($Path)
    try {
        $icon = [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())
        try {
            $icon.Save($stream)
        }
        finally {
            $icon.Dispose()
        }
    }
    finally {
        $stream.Dispose()
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

function Ensure-HelmetIcon {
    if (-not (Test-Path -LiteralPath $iconPath)) {
        New-HelmetIcon -Path $iconPath
    }
}

function Install-DesktopShortcut {
    Copy-SelfToInstallRoot
    Ensure-BridgeScript
    Ensure-HelmetIcon

    $desktop = [Environment]::GetFolderPath("Desktop")
    $shortcutPath = Join-Path $desktop "ShipOS Telemetry Helper.lnk"
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe"
    $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$installedScript`" -Mode $Mode"
    $shortcut.WorkingDirectory = $installRoot
    $shortcut.IconLocation = "$iconPath,0"
    $shortcut.Description = "Starts the ShipOS telemetry helper in the Windows system tray."
    $shortcut.Save()
    return $shortcutPath
}

function Set-HelperStatus {
    param([string]$Status)
    $script:LastStatus = $Status
    if ($script:NotifyIcon) {
        $text = "ShipOS Helper: $Status"
        if ($text.Length -gt 63) {
            $text = $text.Substring(0, 60) + "..."
        }
        $script:NotifyIcon.Text = $text
    }
}

function Show-HelperBalloon {
    param(
        [string]$Message,
        [System.Windows.Forms.ToolTipIcon]$Icon = [System.Windows.Forms.ToolTipIcon]::Info
    )
    if ($script:NotifyIcon) {
        $script:NotifyIcon.ShowBalloonTip(4000, $appName, $Message, $Icon)
    }
}

function Test-LocalBridgeOnline {
    try {
        $null = Invoke-RestMethod -Uri $healthEndpoint -TimeoutSec 2
        return $true
    }
    catch {
        return $false
    }
}

function Get-IpadShipOsUrl {
    try {
        $health = Invoke-RestMethod -Uri $healthEndpoint -TimeoutSec 3
        $lanEndpoint = @($health.lanTelemetryEndpoints | Where-Object { $_ }) | Select-Object -First 1
        if (-not $lanEndpoint) { return $null }
        $lanUri = [Uri][string]$lanEndpoint
        return "http://$($lanUri.Host):5174/"
    }
    catch {
        return $null
    }
}

function Update-IpadMenuStatus {
    if (-not $script:IpadStatusMenuItem) { return }
    $ipadUrl = Get-IpadShipOsUrl
    $script:IpadStatusMenuItem.Text = if ($ipadUrl) {
        "iPad link: $ipadUrl"
    }
    else {
        "iPad link: waiting for private network"
    }
}

function Show-IpadQrCode {
    $ipadUrl = Get-IpadShipOsUrl
    if (-not $ipadUrl) {
        Show-HelperBalloon "No private-network address is available yet. Connect this PC to Wi-Fi or Ethernet and try again." ([System.Windows.Forms.ToolTipIcon]::Warning)
        return
    }
    Open-Uri ($localShipOsUrl + "?share=ipad")
    Show-HelperBalloon "Scan the code to open $ipadUrl on an iPad connected to the same network."
}

function Copy-IpadShipOsUrl {
    $ipadUrl = Get-IpadShipOsUrl
    if (-not $ipadUrl) {
        Show-HelperBalloon "No private-network address is available yet." ([System.Windows.Forms.ToolTipIcon]::Warning)
        return
    }
    Copy-Text $ipadUrl
}

function Get-NodePath {
    $node = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($node) { return $node.Source }
    $node = Get-Command node -ErrorAction SilentlyContinue
    if ($node) { return $node.Source }
    return $null
}

function Start-Bridge {
    $script:ShouldRunBridge = $true

    if ($script:BridgeProcess -and -not $script:BridgeProcess.HasExited) {
        Set-HelperStatus "Bridge running"
        return
    }

    if (Test-LocalBridgeOnline) {
        Set-HelperStatus "Bridge online on 8795"
        return
    }

    try {
        Ensure-BridgeScript
        $nodePath = Get-NodePath
        if (-not $nodePath) {
            Set-HelperStatus "Node.js missing"
            Show-HelperBalloon "Node.js was not found on PATH. Install Node.js, then start the helper again." ([System.Windows.Forms.ToolTipIcon]::Warning)
            return
        }

        $startInfo = New-Object System.Diagnostics.ProcessStartInfo
        $startInfo.FileName = $nodePath
        $startInfo.Arguments = "`"$bridgeScript`""
        $startInfo.WorkingDirectory = $installRoot
        $startInfo.UseShellExecute = $false
        $startInfo.CreateNoWindow = $true
        $startInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
        $startInfo.EnvironmentVariables["SHIPOS_TELEMETRY_HOST"] = "127.0.0.1"
        $startInfo.EnvironmentVariables["SHIPOS_REMOTE_PUSH_URL"] = $remotePushEndpoint
        $startInfo.EnvironmentVariables["SHIPOS_TELEMETRY_LOG"] = $logPath
        if (-not [string]::IsNullOrWhiteSpace($script:RelayKey)) {
            $startInfo.EnvironmentVariables["SHIPOS_REMOTE_PUSH_KEY"] = $script:RelayKey
        }
        if ($Mode -eq "LocalMod") {
            $startInfo.EnvironmentVariables["SHIPOS_WATCH_FILE"] = Join-Path $env:APPDATA "SpaceEngineers\Storage\ShipOSLocalTelemetry.latest.json"
        }

        $process = New-Object System.Diagnostics.Process
        $process.StartInfo = $startInfo
        [void]$process.Start()
        $script:BridgeProcess = $process
        Start-Sleep -Milliseconds 850

        if (Test-LocalBridgeOnline) {
            Set-HelperStatus "Bridge running"
            Show-HelperBalloon "Telemetry bridge is online. Local endpoint: $localEndpoint"
        }
        else {
            Set-HelperStatus "Bridge starting"
        }
    }
    catch {
        Set-HelperStatus "Start failed"
        Show-HelperBalloon $_.Exception.Message ([System.Windows.Forms.ToolTipIcon]::Error)
    }
}

function Stop-Bridge {
    $script:ShouldRunBridge = $false
    if ($script:BridgeProcess -and -not $script:BridgeProcess.HasExited) {
        $script:BridgeProcess.Kill()
        $script:BridgeProcess.WaitForExit(3000) | Out-Null
        $script:BridgeProcess.Dispose()
        $script:BridgeProcess = $null
        Set-HelperStatus "Bridge stopped"
        Show-HelperBalloon "The helper-owned telemetry bridge was stopped."
        return
    }

    Set-HelperStatus "Bridge stopped"
    Show-HelperBalloon "No helper-owned bridge process was running."
}

function Restart-Bridge {
    if ($script:BridgeProcess -and -not $script:BridgeProcess.HasExited) {
        $script:BridgeProcess.Kill()
        $script:BridgeProcess.WaitForExit(3000) | Out-Null
        $script:BridgeProcess.Dispose()
        $script:BridgeProcess = $null
    }
    Start-Bridge
}

function Open-Uri {
    param([Parameter(Mandatory = $true)][string]$Uri)
    Start-Process $Uri
}

function Copy-Text {
    param([Parameter(Mandatory = $true)][string]$Text)
    [System.Windows.Forms.Clipboard]::SetText($Text)
    Show-HelperBalloon "Copied: $Text"
}

function Check-BridgeHealth {
    try {
        $health = Invoke-RestMethod -Uri $healthEndpoint -TimeoutSec 4
        Set-HelperStatus "Bridge online"
        Show-HelperBalloon ("Bridge online. Packets: {0}. Uptime: {1}s." -f $health.packetCount, $health.uptimeSeconds)
    }
    catch {
        Set-HelperStatus "Health offline"
        Show-HelperBalloon "Bridge health check failed: $($_.Exception.Message)" ([System.Windows.Forms.ToolTipIcon]::Warning)
    }
}

function Show-LatestPacket {
    try {
        $packet = Invoke-RestMethod -Uri $localEndpoint -TimeoutSec 4
        $ship = if ($packet.ship) { $packet.ship } elseif ($packet.grid) { $packet.grid } else { "Unknown grid" }
        $position = if ($null -ne $packet.x -and $null -ne $packet.y -and $null -ne $packet.z) {
            "XYZ {0}, {1}, {2}" -f [math]::Round([double]$packet.x), [math]::Round([double]$packet.y), [math]::Round([double]$packet.z)
        }
        else {
            "No position"
        }
        $speed = if ($null -ne $packet.speed) { "{0:n1} m/s" -f [double]$packet.speed } else { "No speed" }
        Show-HelperBalloon "$ship`n$position`n$speed`n$($packet.stamp)"
    }
    catch {
        Show-HelperBalloon "No latest packet yet, or the bridge is offline." ([System.Windows.Forms.ToolTipIcon]::Warning)
    }
}

function Open-LogFolder {
    Ensure-InstallRoot
    Start-Process $installRoot
}

function New-MenuItem {
    param(
        [Parameter(Mandatory = $true)][string]$Text,
        [Parameter(Mandatory = $true)][scriptblock]$Action
    )
    $item = New-Object System.Windows.Forms.ToolStripMenuItem
    $item.Text = $Text
    $item.Add_Click($Action)
    return $item
}

function Start-TrayApp {
    [System.Windows.Forms.Application]::EnableVisualStyles()

    Ensure-HelmetIcon

    $contextMenu = New-Object System.Windows.Forms.ContextMenuStrip
    [void]$contextMenu.Items.Add((New-MenuItem "Open ShipOS" { Open-Uri $localShipOsUrl }))
    [void]$contextMenu.Items.Add((New-MenuItem "Show iPad QR code..." { Show-IpadQrCode }))
    [void]$contextMenu.Items.Add((New-MenuItem "Copy iPad link" { Copy-IpadShipOsUrl }))
    $script:IpadStatusMenuItem = New-Object System.Windows.Forms.ToolStripMenuItem
    $script:IpadStatusMenuItem.Text = "iPad link: checking"
    $script:IpadStatusMenuItem.Enabled = $false
    [void]$contextMenu.Items.Add($script:IpadStatusMenuItem)
    [void]$contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
    $script:RelayStatusMenuItem = New-Object System.Windows.Forms.ToolStripMenuItem
    $script:RelayStatusMenuItem.Text = "EchoBoard relay: checking"
    $script:RelayStatusMenuItem.Enabled = $false
    [void]$contextMenu.Items.Add($script:RelayStatusMenuItem)
    [void]$contextMenu.Items.Add((New-MenuItem "Pair EchoBoard relay key..." { Configure-RelayKey }))
    [void]$contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
    [void]$contextMenu.Items.Add((New-MenuItem "Open local bridge health" { Open-Uri $healthEndpoint }))
    [void]$contextMenu.Items.Add((New-MenuItem "Health check" { Check-BridgeHealth }))
    [void]$contextMenu.Items.Add((New-MenuItem "Latest packet" { Show-LatestPacket }))
    [void]$contextMenu.Items.Add((New-MenuItem "Copy local endpoint" { Copy-Text $localEndpoint }))
    [void]$contextMenu.Items.Add((New-MenuItem "Copy EchoBoard relay endpoint" { Copy-Text $relayEndpoint }))
    [void]$contextMenu.Items.Add((New-MenuItem "Open helper log folder" { Open-LogFolder }))
    [void]$contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
    [void]$contextMenu.Items.Add((New-MenuItem "Restart bridge" { Restart-Bridge }))
    [void]$contextMenu.Items.Add((New-MenuItem "Stop bridge" { Stop-Bridge }))
    [void]$contextMenu.Items.Add((New-MenuItem "Install desktop shortcut" {
        $path = Install-DesktopShortcut
        Show-HelperBalloon "Desktop shortcut ready: $path"
    }))
    $versionItem = New-Object System.Windows.Forms.ToolStripMenuItem
    $versionItem.Text = "Helper version $helperVersion"
    $versionItem.Enabled = $false
    [void]$contextMenu.Items.Add($versionItem)
    [void]$contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
    [void]$contextMenu.Items.Add((New-MenuItem "Exit helper" {
        Stop-Bridge
        $script:NotifyIcon.Visible = $false
        $script:NotifyIcon.Dispose()
        [System.Windows.Forms.Application]::Exit()
    }))

    $script:NotifyIcon = New-Object System.Windows.Forms.NotifyIcon
    $script:NotifyIcon.Icon = New-Object System.Drawing.Icon $iconPath
    $script:NotifyIcon.ContextMenuStrip = $contextMenu
    $script:NotifyIcon.Visible = $true
    $script:NotifyIcon.Add_DoubleClick({ Open-Uri $localShipOsUrl })

    Set-HelperStatus "Loading"
    Load-HelperConfig
    Start-Bridge
    Update-IpadMenuStatus

    $timer = New-Object System.Windows.Forms.Timer
    $timer.Interval = 10000
    $timer.Add_Tick({
        if ($script:ShouldRunBridge) {
            if ($script:BridgeProcess -and $script:BridgeProcess.HasExited) {
                $script:BridgeProcess.Dispose()
                $script:BridgeProcess = $null
                Start-Bridge
            }
            elseif (Test-LocalBridgeOnline) {
                Set-HelperStatus "Bridge online"
            }
        }
        Update-IpadMenuStatus
    })
    $timer.Start()

    [System.Windows.Forms.Application]::Run()
}

Copy-SelfToInstallRoot

if ($InstallShortcut) {
    $createdShortcut = Install-DesktopShortcut
    Write-Host "Created desktop shortcut: $createdShortcut"
}

if ($NoStart) {
    exit 0
}

if ($PSCommandPath) {
    $currentFull = [IO.Path]::GetFullPath($PSCommandPath)
    $installedFull = [IO.Path]::GetFullPath($installedScript)
    if (-not [string]::Equals($currentFull, $installedFull, [StringComparison]::OrdinalIgnoreCase)) {
        $arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$installedScript`" -Mode $Mode"
        Start-Process -FilePath "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe" -ArgumentList $arguments -WorkingDirectory $installRoot -WindowStyle Hidden
        exit 0
    }
}

Start-TrayApp
