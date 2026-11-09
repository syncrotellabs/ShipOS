param(
    [string]$SaveRoot = (Join-Path $env:APPDATA 'SpaceEngineers\Saves'),
    [string]$DataRoot = (Join-Path $env:LOCALAPPDATA 'ShipOS\Data'),
    [switch]$IgnoreGameProcess
)
$ErrorActionPreference = 'Stop'
$markerPath = Join-Path $DataRoot 'auto-configure-saves'
$statusPath = Join-Path $DataRoot 'save-configuration.json'
$modNeedle = '<Name>ShipOSLocalTelemetry</Name>'

function Write-ShipOsStatus([string]$state, [string]$message, [string]$world = '', [string]$backup = '') {
    New-Item -ItemType Directory -Path $DataRoot -Force | Out-Null
    $json = [ordered]@{
        state = $state
        message = $message
        world = $world
        backup = $backup
        checkedAt = [DateTime]::UtcNow.ToString('o')
    } | ConvertTo-Json
    [IO.File]::WriteAllText($statusPath, $json, (New-Object Text.UTF8Encoding $false))
}

function Get-FileEncoding([string]$path) {
    $bytes = [IO.File]::ReadAllBytes($path)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) { return New-Object Text.UTF8Encoding $true }
    if ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) { return New-Object Text.UnicodeEncoding $false,$true }
    if ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFE -and $bytes[1] -eq 0xFF) { return New-Object Text.UnicodeEncoding $true,$true }
    return New-Object Text.UTF8Encoding $false
}

function Add-ShipOsMod([string]$text) {
    if ($text.IndexOf($modNeedle, [StringComparison]::OrdinalIgnoreCase) -ge 0) { return $text }
    $closing = $text.IndexOf('</Mods>', [StringComparison]::OrdinalIgnoreCase)
    if ($closing -lt 0) { throw 'The save has no Mods section.' }
    $newline = if ($text.Contains("`r`n")) { "`r`n" } else { "`n" }
    $lineStart = $text.LastIndexOf($newline, $closing, [StringComparison]::Ordinal)
    $lineStart = if ($lineStart -lt 0) { 0 } else { $lineStart + $newline.Length }
    $closingIndent = $text.Substring($lineStart, $closing - $lineStart)
    $itemIndent = $closingIndent + '  '
    $entry = [string]::Join($newline, @(
        $itemIndent + '<ModItem FriendlyName="ShipOSLocalTelemetry">',
        $itemIndent + '  <Name>ShipOSLocalTelemetry</Name>',
        $itemIndent + '  <PublishedServiceName>Steam</PublishedServiceName>',
        $itemIndent + '</ModItem>'
    )) + $newline
    $updated = $text.Insert($lineStart, $entry)
    $document = New-Object Xml.XmlDocument
    $document.PreserveWhitespace = $true
    $document.LoadXml($updated)
    return $updated
}

New-Item -ItemType Directory -Path $DataRoot -Force | Out-Null
if (-not (Test-Path -LiteralPath $markerPath)) {
    Write-ShipOsStatus 'disabled' 'Automatic save configuration is disabled.'
    exit 0
}
if (-not $IgnoreGameProcess -and (Get-Process -Name 'SpaceEngineers' -ErrorAction SilentlyContinue)) {
    Write-ShipOsStatus 'pending' 'Space Engineers is running. The latest local save will be configured after the game closes.'
    exit 2
}
if (-not (Test-Path -LiteralPath $SaveRoot)) {
    Write-ShipOsStatus 'waiting' 'No local Space Engineers saves were found yet.'
    exit 0
}

$resolvedRoot = [IO.Path]::GetFullPath($SaveRoot).TrimEnd([IO.Path]::DirectorySeparatorChar)
$candidates = Get-ChildItem -LiteralPath $resolvedRoot -Recurse -File -Filter 'Sandbox_config.sbc' -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName.IndexOf([IO.Path]::DirectorySeparatorChar + 'Backup' + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -lt 0 } |
    ForEach-Object {
        $worldRoot = $_.Directory.FullName
        $checkpoint = Join-Path $worldRoot 'Sandbox.sbc'
        if (Test-Path -LiteralPath $checkpoint) {
            [pscustomobject]@{ Config = $_.FullName; Checkpoint = $checkpoint; WorldRoot = $worldRoot; LastWrite = [Math]::Max($_.LastWriteTimeUtc.Ticks, (Get-Item -LiteralPath $checkpoint).LastWriteTimeUtc.Ticks) }
        }
    } | Sort-Object LastWrite -Descending

$candidate = $candidates | Select-Object -First 1
if (-not $candidate) {
    Write-ShipOsStatus 'waiting' 'No complete local Space Engineers save was found yet.'
    exit 0
}
foreach ($file in @($candidate.Config, $candidate.Checkpoint)) {
    $resolved = [IO.Path]::GetFullPath($file)
    if (-not $resolved.StartsWith($resolvedRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe save path.' }
}

$files = @($candidate.Config, $candidate.Checkpoint)
$prepared = @()
foreach ($file in $files) {
    $encoding = Get-FileEncoding $file
    $original = [IO.File]::ReadAllText($file, $encoding)
    $updated = Add-ShipOsMod $original
    $prepared += [pscustomobject]@{ Path = $file; Encoding = $encoding; Original = $original; Updated = $updated; Changed = ($updated -cne $original) }
}
$worldName = Split-Path $candidate.WorldRoot -Leaf
if (-not ($prepared | Where-Object Changed)) {
    Write-ShipOsStatus 'configured' 'ShipOS telemetry is already enabled for the latest local save.' $worldName
    exit 0
}

$backupRoot = Join-Path $DataRoot ('save-backups\' + [DateTime]::Now.ToString('yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
foreach ($item in $prepared) { Copy-Item -LiteralPath $item.Path -Destination (Join-Path $backupRoot ([IO.Path]::GetFileName($item.Path))) }
Set-Content -LiteralPath (Join-Path $backupRoot 'world.txt') -Value $candidate.WorldRoot -Encoding UTF8

$temporary = @()
try {
    foreach ($item in $prepared | Where-Object Changed) {
        $temp = Join-Path ([IO.Path]::GetDirectoryName($item.Path)) ('.shipos-' + [Guid]::NewGuid().ToString('N') + '.tmp')
        [IO.File]::WriteAllText($temp, $item.Updated, $item.Encoding)
        $check = New-Object Xml.XmlDocument
        $check.Load($temp)
        $temporary += [pscustomobject]@{ Temp = $temp; Target = $item.Path; Swap = $item.Path + '.shipos-replaced-' + [Guid]::NewGuid().ToString('N') + '.bak' }
    }
    foreach ($item in $temporary) {
        [IO.File]::Replace($item.Temp, $item.Target, $item.Swap, $true)
        Remove-Item -LiteralPath $item.Swap -Force
    }
} catch {
    foreach ($item in $prepared) {
        $backup = Join-Path $backupRoot ([IO.Path]::GetFileName($item.Path))
        if (Test-Path -LiteralPath $backup) { Copy-Item -LiteralPath $backup -Destination $item.Path -Force }
    }
    foreach ($item in $temporary) {
        if (Test-Path -LiteralPath $item.Temp) { Remove-Item -LiteralPath $item.Temp -Force }
        if (Test-Path -LiteralPath $item.Swap) { Remove-Item -LiteralPath $item.Swap -Force }
    }
    Write-ShipOsStatus 'error' $_.Exception.Message $worldName $backupRoot
    throw
}

Write-ShipOsStatus 'configured' 'ShipOS telemetry was enabled for the latest local save. It will load the next time that world starts.' $worldName $backupRoot
