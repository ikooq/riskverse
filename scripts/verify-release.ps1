param([Parameter(Mandatory=$true)][string]$Path)
$ErrorActionPreference='Stop'
$releasePath=(Resolve-Path -LiteralPath $Path).Path
$manifestPath=Join-Path $releasePath 'MANIFEST.json'
$manifest=Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$expected=@{}
foreach($entry in $manifest){
    $relative=$entry.Path.Replace('\','/')
    if([IO.Path]::IsPathRooted($entry.Path) -or $relative -match '(^/|:|(^|/)\.\.(/|$)|(^|/)\.env(?!\.example$)|(^|/)node_modules/)'){throw "Disallowed release entry: $relative"}
    if($expected.ContainsKey($relative)){throw "Duplicate manifest entry: $relative"}
    $expected[$relative]=$true
    $file=Join-Path $releasePath $entry.Path
    if(-not(Test-Path -LiteralPath $file -PathType Leaf)){throw "Missing release file: $relative"}
    if((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ne $entry.SHA256){throw "Hash mismatch: $relative"}
}
foreach($file in Get-ChildItem -LiteralPath $releasePath -Recurse -Force -File){
    $relative=$file.FullName.Substring($releasePath.Length+1).Replace('\','/')
    if($relative -ne 'MANIFEST.json' -and -not $expected.ContainsKey($relative)){throw "Unlisted release file: $relative"}
}
Write-Output "Manifest verified: $($expected.Count) files."
