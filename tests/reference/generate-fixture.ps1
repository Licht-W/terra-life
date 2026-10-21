param([string]$Compiler = 'clang')
$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$buildDirectory = Join-Path $projectRoot '.npm-cache/tl-m1-001-reference'
[System.IO.Directory]::CreateDirectory($buildDirectory) | Out-Null
$hashes = @{
    'xoshiro128starstar.c' = '2E3E540E15E1B1EDF6144509BA3A71BC4611E3676D52E03D567A0F230A141A67'
    'splitmix64.c' = '071795A8E29978A5CBD7015CE8F7D772E7AB4631E574E9102B748FE99105FF3D'
}
foreach ($name in $hashes.Keys) {
    $source = Join-Path $PSScriptRoot "vendor/$name"
    if ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne $hashes[$name]) {
        throw "Reference source hash mismatch: $name"
    }
    $content = [System.IO.File]::ReadAllText($source)
    if ($name -eq 'xoshiro128starstar.c') {
        # Only next() and jump(). The later long/arbitrary jumps are outside this task;
        # the arbitrary-jump extension also includes a separate f2x.c dependency.
        $boundary = $content.IndexOf('/* This is the long-jump function')
        if ($boundary -lt 0) { throw 'Reference extraction boundary missing' }
        $content = $content.Substring(0, $boundary)
    }
    [System.IO.File]::WriteAllText((Join-Path $buildDirectory $name), $content)
}
$executable = Join-Path $buildDirectory 'generate-fixture.exe'
$objectFile = Join-Path $buildDirectory 'generate-fixture.o'
& $Compiler -std=c11 -Wall -Wextra -Wno-sign-compare -Werror -I $buildDirectory -c (Join-Path $PSScriptRoot 'generate-fixture.c') -o $objectFile
if ($LASTEXITCODE -ne 0) { throw "C compilation failed: $LASTEXITCODE" }
& $Compiler $objectFile -o $executable
if ($LASTEXITCODE -ne 0) { throw "C linking failed: $LASTEXITCODE" }
$output = & $executable
if ($LASTEXITCODE -ne 0) { throw "Reference execution failed: $LASTEXITCODE" }
$json = ($output -join "`n") + "`n"
$null = ConvertFrom-Json -InputObject $json
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot 'random-vectors.json'), $json)
Write-Output 'Generated random-vectors.json from authors C sources.'
