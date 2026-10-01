const { execFileSync } = require('child_process');
const fs = require('fs');

function runPowerShell(script) {
    execFileSync(
        'powershell.exe',
        [
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy',
            'Bypass',
            '-Command',
            script
        ],
        {
            stdio: 'inherit',
            windowsHide: false,
            env: process.env
        }
    );
}

// ============================================================
// INPUTS FROM ENV
// ============================================================

const tailKey = process.env.TAIL_KEY || '';
const adminPass = process.env.ADMIN_PASS || '';
const useCustom = process.env.USE_CUSTOM_USER || 'false';
const username = process.env.CUSTOM_USERNAME || '';
const customPass = process.env.CUSTOM_PASSWORD || '';

// ============================================================
// MASK SECRETS
// ============================================================

function maskSecret(value) {
    if (value) {
        process.stdout.write(`::add-mask::${value}\n`);
    }
}

maskSecret(tailKey);
maskSecret(adminPass);
maskSecret(customPass);

console.log('Все секреты успешно замаскированы.');

// ============================================================
// MAIN POWERSHELL LOGIC
// ============================================================

const ps = `
$ErrorActionPreference = "Stop"

$tsKey = ${JSON.stringify(tailKey)}
$adminPass = ${JSON.stringify(adminPass)}
$useCustom = ${JSON.stringify(useCustom)}
$username = ${JSON.stringify(username)}
$customPass = ${JSON.stringify(customPass)}

# ============================================================
# 1. DOWNLOAD TAILSCALE
# ============================================================

Write-Host "Скачиваю Tailscale..."

Invoke-WebRequest `
    + `-Uri "https://pkgs.tailscale.com/stable/tailscale-setup-latest.exe" `
    + `-OutFile "tailscale-setup.exe"

# ============================================================
# 2. INSTALL TAILSCALE
# ============================================================

Write-Host "Устанавливаю Tailscale в тихом режиме..."

Start-Process `
    -FilePath "tailscale-setup.exe" `
    -ArgumentList "/quiet", "/norestart" `
    -Wait

# ============================================================
# 3. AUTH TAILSCALE
# ============================================================

Write-Host "Запускаю Tailscale и настраиваю exit node..."

& "C:\\Program Files\\Tailscale\\tailscale.exe" `
    up `
    --authkey="$tsKey" `
    --unattended `
    --advertise-exit-node

$tsIp = & "C:\\Program Files\\Tailscale\\tailscale.exe" ip -4

Write-Host "=== TAILSCALE IP: $tsIp ===" -ForegroundColor Green

# ============================================================
# 4. RUNNERADMIN PASSWORD
# ============================================================

if (-not [string]::IsNullOrEmpty($adminPass)) {

    Write-Host "Меняем пароль runneradmin..."

    net user runneradmin "$adminPass"

}
else {

    Write-Host "Пароль для runneradmin не указан."

}

# ============================================================
# 5. CUSTOM USER
# ============================================================

if (
    $useCustom -eq "true" `
    -and `
    -not [string]::IsNullOrEmpty($username) `
    -and `
    -not [string]::IsNullOrEmpty($customPass)
) {

    Write-Host "Создаю кастомного пользователя: $username..."

    $secPassword = ConvertTo-SecureString `
        "$customPass" `
        -AsPlainText `
        -Force

    New-LocalUser `
        -Name $username `
        -Password $secPassword `
        -FullName "Cloud PC User" `
        -Description "Custom Cloud PC Admin"

    Add-LocalGroupMember `
        -Group "Administrators" `
        -Member $username
}

# ============================================================
# 6. ENABLE RDP
# ============================================================

Write-Host "Включаю RDP..."

Set-ItemProperty `
    -Path 'HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server' `
    -Name "fDenyTSConnections" `
    -Value 0

Enable-NetFirewallRule `
    -DisplayGroup "Remote Desktop"

Write-Host "========================================"
Write-Host "WIN RDP ENABLER READY"
Write-Host "========================================" -ForegroundColor Green
`;

runPowerShell(ps);
