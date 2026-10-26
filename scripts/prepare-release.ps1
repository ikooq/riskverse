# Run from any directory: powershell -File scripts/prepare-release.ps1
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $taskRoot
try {
    $releaseName = 'riskverse-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,6)
    $releaseRoot = Join-Path $taskRoot ('output/releases/' + $releaseName)
    $payload = Join-Path $releaseRoot 'riskverse'
    New-Item -ItemType Directory -Path $payload -Force | Out-Null
    # Explicit source allowlist: never copy the workspace wholesale.
    $sources = @('src','server','api','public','scripts','docs','index.html','package.json','package-lock.json','tsconfig.json','vite.config.ts','vitest.config.ts','vercel.json','README.md','DEMO.md','PROJECT_REVIEW.md','design-qa.md','AUDIT_STORAGE.md','.gitignore','.vercelignore','.env.example','Dockerfile','.dockerignore')
    # Selected evidence only. Never recursively include output or old releases.
    $materials = @('output/presentation/RISKVERSE_AIITSolutions_2026-10-24.pptx','output/ai-evaluation/results.json','output/ai-evaluation/results-after-prompt.json','output/ai-evaluation/images/forklift-loading.jpg','output/ai-evaluation/images/aisle-control.jpg')
    $materials += @('output/playwright/finished-production.png','output/playwright/finished-mobile.png','output/playwright/finished-report.png','output/playwright/finished-report.html')
    $sources += @($materials | Where-Object { Test-Path -LiteralPath (Join-Path $taskRoot $_) })
    function Get-SourceFingerprint {
        foreach ($entry in $sources) {
            $target = Join-Path $taskRoot $entry
            if (-not (Test-Path -LiteralPath $target)) { throw "Missing release input: $entry" }
            if ((Get-Item -LiteralPath $target -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {throw "Release input cannot be a link: $entry"}
            if (Get-ChildItem -LiteralPath $target -Recurse -Force | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }) {throw "Release input contains a link: $entry"}
            Get-ChildItem -LiteralPath $target -File -Recurse -Force | Sort-Object FullName | ForEach-Object {
                $_.FullName.Substring($taskRoot.Length) + ':' + (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
            }
        }
    }
    $before = @(Get-SourceFingerprint)
    function Invoke-LoggedCommand([string]$Executable, [string[]]$CommandArguments, [string]$LogName) {
        # Windows PowerShell treats native stderr warnings as errors under Stop.
        # Decide success by the process exit code; retain warnings in the log.
        $ErrorActionPreference = 'Continue'
        & $Executable @CommandArguments 2>&1 | Tee-Object -FilePath (Join-Path $releaseRoot $LogName)
        $taskExitCode = $LASTEXITCODE
        $ErrorActionPreference = 'Stop'
        if ($taskExitCode -ne 0) { throw "$Executable exited with $taskExitCode; release ZIP was not created." }
    }
    Invoke-LoggedCommand 'npm.cmd' @('test') 'tests.log'
    Invoke-LoggedCommand 'npm.cmd' @('run','build') 'build.log'
    Invoke-LoggedCommand 'node' @('scripts/check-build-secrets.mjs') 'secrets.log'
    Invoke-LoggedCommand 'npx.cmd' @('--no-install','tsx','scripts/measure-demo.ts',(Join-Path $payload 'evidence')) 'measurements.log'
    foreach ($entry in $sources) {
        $destination = Join-Path $payload $entry
        New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path $taskRoot $entry) -Destination $destination -Recurse -Force
    }
    Copy-Item -LiteralPath (Join-Path $taskRoot 'dist') -Destination $payload -Recurse
    Copy-Item -LiteralPath (Join-Path $taskRoot 'dist-server') -Destination $payload -Recurse
    $after = @(Get-SourceFingerprint)
    if (Compare-Object $before $after) { throw 'Source files changed during verification. Run again after the other chats finish; ZIP was not created.' }
    if (Select-String -LiteralPath (Join-Path $payload '.env.example') -Pattern '^\s*(GEMINI_API_KEY|OPENAI_API_KEY)\s*=\s*\S+') {throw 'Example environment contains a filled API key; release ZIP was not created.'}
    Copy-Item -LiteralPath (Join-Path $releaseRoot 'tests.log'),(Join-Path $releaseRoot 'build.log'),(Join-Path $releaseRoot 'secrets.log') -Destination $payload
    Get-ChildItem -LiteralPath $payload -Recurse -Force -File | Sort-Object FullName | ForEach-Object {
        [pscustomobject]@{Path=$_.FullName.Substring($payload.Length+1);SHA256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash}
    } | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $payload 'MANIFEST.json') -Encoding utf8
    & (Join-Path $taskRoot 'scripts/verify-release.ps1') -Path $payload
    $archivePath = Join-Path $releaseRoot ($releaseName + '.zip')
    Compress-Archive -LiteralPath $payload -DestinationPath $archivePath
    (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash | Set-Content -LiteralPath ($archivePath + '.sha256') -Encoding ascii
    Write-Output "Release verified and packaged: $archivePath"
    Write-Output 'Live AI quality and browser acceptance remain separate checks; see docs/HANDOFF.md.'
} finally { Pop-Location }
