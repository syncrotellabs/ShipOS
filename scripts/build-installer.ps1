param([Parameter(Mandatory=$true)][string]$NodePath, [Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$releaseVersion = (Get-Content -LiteralPath (Join-Path $repoRoot 'package.json') -Raw | ConvertFrom-Json).version
if ($releaseVersion -notmatch '^\d+\.\d+\.\d+(-[a-z0-9.]+)?$') { throw 'Invalid release version.' }
$outputRoot = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $repoRoot 'dist\index.html'))) { throw 'Run pnpm build first.' }
if (-not (Test-Path -LiteralPath $NodePath)) { throw 'Supply a trusted Windows x64 Node 24 executable.' }
$nodeVersion = & $NodePath --version
if (-not $nodeVersion.StartsWith('v24.')) { throw 'This beta package is tested with Node 24.' }
$stage = Join-Path ([IO.Path]::GetTempPath()) ('ShipOS-package-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage -Force | Out-Null
$stageRuntime = Join-Path $stage 'runtime'
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
New-Item -ItemType Directory -Path $stageRuntime -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $repoRoot 'dist') -Destination $stage -Recurse
Compress-Archive -LiteralPath (Join-Path $repoRoot 'public\shipos\addons\shipos-local-telemetry-mod\ShipOSLocalTelemetry'),(Join-Path $repoRoot 'public\shipos\addons\shipos-local-telemetry-mod\README.md'),(Join-Path $repoRoot 'public\shipos\addons\shipos-local-telemetry-mod\install-shipos-local-telemetry-mod.cmd') -DestinationPath (Join-Path $stage 'dist\shipos\addons\shipos-local-telemetry-mod.zip') -CompressionLevel Optimal -Force
foreach ($name in @('server.mjs','validate.mjs','state-schema.json','helper.ps1')) { Copy-Item -LiteralPath (Join-Path $repoRoot ('runtime\' + $name)) -Destination $stageRuntime }
Copy-Item -LiteralPath (Join-Path $repoRoot 'installer\Launch-ShipOS.cmd') -Destination (Join-Path $stage 'Launch-ShipOS.cmd')
Copy-Item -LiteralPath $NodePath -Destination (Join-Path $stageRuntime 'node.exe')
Copy-Item -LiteralPath (Join-Path $repoRoot 'LICENSE'),(Join-Path $repoRoot 'THIRD_PARTY_NOTICES.md'),(Join-Path $repoRoot 'README.md'),(Join-Path $repoRoot 'REQUIREMENTS.md'),(Join-Path $repoRoot 'PRIVACY.md'),(Join-Path $repoRoot 'SECURITY.md'),(Join-Path $repoRoot 'SUPPORT.md') -Destination $stage
Copy-Item -LiteralPath (Join-Path $repoRoot 'installer\README-FIRST.html') -Destination (Join-Path $stage 'README-FIRST.html')
New-Item -ItemType Directory -Path (Join-Path $stage 'docs') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $repoRoot 'docs\BETA_ACCEPTANCE.md'),(Join-Path $repoRoot 'docs\RELEASE_CHECKLIST.md'),(Join-Path $repoRoot 'docs\RELEASE_NOTES.md') -Destination (Join-Path $stage 'docs')
if (Test-Path -LiteralPath (Join-Path $repoRoot 'runtime\licenses')) { Copy-Item -LiteralPath (Join-Path $repoRoot 'runtime\licenses') -Destination (Join-Path $stage 'licenses') -Recurse }
New-Item -ItemType Directory -Path (Join-Path $stage 'mod') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $repoRoot 'public\shipos\addons\shipos-local-telemetry-mod\ShipOSLocalTelemetry') -Destination (Join-Path $stage 'mod') -Recurse
# The installed uninstaller uses the same validated removal path without embedding
# another copy of the 50+ MB application payload.
& $csc /nologo /target:winexe /platform:x64 /optimize+ /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:Microsoft.CSharp.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll ('/resource:' + (Join-Path $repoRoot 'LICENSE') + ',ShipOS.License') ('/out:' + (Join-Path $stage 'Uninstall.exe')) (Join-Path $repoRoot 'installer\Setup.cs')
if ($LASTEXITCODE -ne 0) { throw 'Installed uninstaller compilation failed.' }
$zip = Join-Path $outputRoot ('ShipOS-' + $releaseVersion + '-portable.zip')
if (Test-Path -LiteralPath $zip) { throw 'Output already exists. Choose a fresh output directory so prior builds are preserved.' }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -CompressionLevel Optimal
$exe = Join-Path $outputRoot ('ShipOS-' + $releaseVersion + '-Setup.exe')
& $csc /nologo /target:winexe /platform:x64 /optimize+ /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:Microsoft.CSharp.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll ('/resource:' + $zip + ',ShipOS.Payload') ('/resource:' + (Join-Path $repoRoot 'LICENSE') + ',ShipOS.License') ('/out:' + $exe) (Join-Path $repoRoot 'installer\Setup.cs')
if ($LASTEXITCODE -ne 0) { throw 'Installer compilation failed.' }
$uninstaller = Join-Path $outputRoot ('ShipOS-' + $releaseVersion + '-Uninstall.exe')
& $csc /nologo /target:winexe /platform:x64 /optimize+ /reference:System.Windows.Forms.dll ('/out:' + $uninstaller) (Join-Path $repoRoot 'installer\UninstallLauncher.cs')
if ($LASTEXITCODE -ne 0) { throw 'Standalone uninstaller launcher compilation failed.' }
$readFirst = Join-Path $outputRoot ('ShipOS-' + $releaseVersion + '-README-FIRST.html')
Copy-Item -LiteralPath (Join-Path $repoRoot 'installer\README-FIRST.html') -Destination $readFirst
Copy-Item -LiteralPath (Join-Path $repoRoot 'REQUIREMENTS.md'),(Join-Path $repoRoot 'PRIVACY.md'),(Join-Path $repoRoot 'SECURITY.md'),(Join-Path $repoRoot 'SUPPORT.md'),(Join-Path $repoRoot 'docs\RELEASE_NOTES.md'),(Join-Path $repoRoot 'docs\WEBSITE_RELEASE_COPY.md') -Destination $outputRoot
$releaseFiles = @($exe,$uninstaller,$zip,$readFirst)
$releaseHashes = Get-FileHash -Algorithm SHA256 -LiteralPath $releaseFiles
$releaseHashes | ForEach-Object { $_.Hash.ToLowerInvariant() + '  ' + [IO.Path]::GetFileName($_.Path) } | Set-Content -LiteralPath (Join-Path $outputRoot 'SHA256SUMS.txt') -Encoding ASCII
$manifest = [ordered]@{
    schema = 'shipos-release-v1'
    product = 'ShipOS'
    version = $releaseVersion
    channel = 'public-beta'
    createdUtc = [DateTime]::UtcNow.ToString('o')
    platform = 'windows-x64'
    codeSigned = $false
    networkModel = 'local-only; optional trusted-LAN HTTP'
    artifacts = @($releaseHashes | ForEach-Object { [ordered]@{ file = [IO.Path]::GetFileName($_.Path); bytes = (Get-Item -LiteralPath $_.Path).Length; sha256 = $_.Hash.ToLowerInvariant() } })
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $outputRoot 'RELEASE-MANIFEST.json') -Encoding UTF8
Write-Output ('Installer: ' + $exe)
Write-Output ('Uninstaller: ' + $uninstaller)
Write-Output ('Build staging retained for inspection: ' + $stage)
