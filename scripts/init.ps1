$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$envPath = Join-Path $projectRoot '.env'
function New-Password {
    $bytes = New-Object byte[] 24
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return [Convert]::ToBase64String($bytes)
}
if (Test-Path -LiteralPath $envPath) {
    $content = [System.IO.File]::ReadAllText($envPath)
    if ($content -match '(?m)^MCP_PASSWORD=.+\r?$') {
        Write-Host '.env already contains MCP_PASSWORD; kept existing credentials.'
        exit 0
    }
    $content = $content.TrimEnd() + "`nMCP_PASSWORD=$(New-Password)`n"
} else {
    $content = "NEKO_IP=127.0.0.1`nTZ=Asia/Taipei`nNEKO_USER_PASSWORD=$(New-Password)`nNEKO_ADMIN_PASSWORD=$(New-Password)`nMCP_PASSWORD=$(New-Password)`n"
}
[System.IO.File]::WriteAllText($envPath, $content, (New-Object System.Text.UTF8Encoding($false)))
Write-Host 'Saved random credentials to .env. Existing Neko credentials were preserved.'
