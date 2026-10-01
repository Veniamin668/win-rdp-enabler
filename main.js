```js
const { execFileSync } = require('child_process');

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

console.log('[Win RDP Enabler] Secrets masked.');
console.log(`[Win RDP Enabler] TAIL_KEY: ${tailKey ? 'provided' : 'not provided'}`);
console.log(`[Win RDP Enabler] ADMIN_PASS: ${adminPass ? 'provided' : 'not provided'}`);
console.log(`[Win RDP Enabler] CUSTOM_PASSWORD: ${customPass ? 'provided' : 'not provided'}`);
console.log(`[Win RDP Enabler] USE_CUSTOM_USER: ${useCustom}`);
console.log(`[Win RDP Enabler] CUSTOM_USERNAME: ${username || 'not provided'}`);

// ============================================================
// VALIDATION
// ============================================================

if (!tailKey) {
    console.error('[Win RDP Enabler] ERROR: TAIL_KEY is not provided.');
    process.exit(1);
}

// ============================================================
// MAIN POWERSHELL LOGIC
// ============================================================

const ps = `
$ErrorActionPreference = "Stop"

$tsKey = $env:TAIL_KEY
$adminPass = $env:ADMIN_PASS
$useCustom = $env:USE_CUSTOM_USER
$username = $env:CUSTOM_USERNAME
$customPass = $env:CUSTOM_PASSWORD

# ============================================================
# 1. DOWNLOAD TAILSCALE
# ============================================================

Write-Host "Скачиваю Tailscale..."

$installer = Join-Path $env:RUNNER_TEMP "tailscale-setup.exe"

Invoke-WebRequest \`
    -Uri "https://pkgs.tailscale.com/stable/tailscale-setup-latest.exe" \`
    -OutFile $installer

# ============================================================
# 2. INSTALL TAILSCALE
# ============================================================

Write-Host "Устанавливаю Tailscale в тихом режиме..."

$installProcess = Start-Process \`
    -FilePath $installer \`
    -ArgumentList "/quiet", "/norestart" \`
    -Wait \`
    -PassThru

if ($installProcess.ExitCode -ne 0) {
    throw "Tailscale installer failed with exit code $($installProcess.ExitCode)"
}

# ============================================================
# 3. AUTH TAILSCALE
# ============================================================

$tailscaleExe = "C:\\Program Files\\Tailscale\\tailscale.exe"

if (-not (Test-Path $tailscaleExe)) {
    throw "Tailscale executable not found: $tailscaleExe"
}

Write-Host "Запускаю Tailscale и настраиваю exit node..."

& $tailscaleExe up \`
    --authkey="$tsKey" \`
    --unattended \`
    --advertise-exit-node

if ($LASTEXITCODE -ne 0) {
    throw "Tailscale authentication failed with exit code $LASTEXITCODE"
}

$tsIp = & $tailscaleExe ip -4

Write-Host "=== TAILSCALE IP: $tsIp ===" -ForegroundColor Green

# ============================================================
# 4. RUNNERADMIN PASSWORD
# ============================================================

if (-not [string]::IsNullOrEmpty($adminPass)) {

    Write-Host "Меняем пароль runneradmin..."

    net user runneradmin "$adminPass"

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to change runneradmin password."
    }

}
else {

    Write-Host "Пароль для runneradmin не указан."

}

# ============================================================
# 5. CUSTOM USER
# ============================================================

if (
    $useCustom -eq "true" \`
    -and \`
    -not [string]::IsNullOrEmpty($username) \`
    -and \`
    -not [string]::IsNullOrEmpty($customPass)
) {

    Write-Host "Создаю кастомного пользователя: $username..."

    $secPassword = ConvertTo-SecureString \`
        "$customPass" \`
        -AsPlainText \`
        -Force

    New-LocalUser \`
        -Name $username \`
        -Password $secPassword \`
        -FullName "Cloud PC User" \`
        -Description "Custom Cloud PC Admin"

    Add-LocalGroupMember \`
        -Group "Administrators" \`
        -Member $username
}

# ============================================================
# 6. ENABLE RDP
# ============================================================

Write-Host "Включаю RDP..."

Set-ItemProperty \`
    -Path 'HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server' \`
    -Name "fDenyTSConnections" \`
    -Value 0

Enable-NetFirewallRule \`
    -DisplayGroup "Remote Desktop"

# ============================================================
# 7. CLEANUP INSTALLER
# ============================================================

Remove-Item \`
    -Path $installer \`
    -Force \`
    -ErrorAction SilentlyContinue

Write-Host "========================================"
Write-Host "WIN RDP ENABLER READY"
Write-Host "========================================" -ForegroundColor Green
`;

try {
    runPowerShell(ps);
} catch (error) {
    console.error('[Win RDP Enabler] Action failed.');
    process.exit(1);
}
```
