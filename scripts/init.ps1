$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$envPath = Join-Path $projectRoot '.env'
if (Test-Path -LiteralPath $envPath) {
    Write-Host '.env already exists; kept existing credentials.'
    exit 0
}
function New-Password {
    $bytes = New-Object byte[] 24
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return [Convert]::ToBase64String($bytes)
}
$content = "NEKO_IP=127.0.0.1`nNEKO_USER_PASSWORD=$(New-Password)`nNEKO_ADMIN_PASSWORD=$(New-Password)`n"
[System.IO.File]::WriteAllText($envPath, $content, (New-Object System.Text.UTF8Encoding($false)))
Write-Host 'Created .env with random credentials. Read it locally to sign into Neko.'
