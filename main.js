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
const hostname = process.env.HOSTNAME || '';

// ============================================================
// MASK SECRETS
// ============================================================

function maskSecret(value) {
    if (value) {
        process.stdout.write('::add-mask::' + value + '\n');
    }
}

maskSecret(tailKey);
maskSecret(adminPass);
maskSecret(customPass);

console.log('[Win RDP Enabler] Secrets masked.');
console.log('[Win RDP Enabler] TAIL_KEY: ' + (tailKey ? 'provided' : 'not provided'));
console.log('[Win RDP Enabler] ADMIN_PASS: ' + (adminPass ? 'provided' : 'not provided'));
console.log('[Win RDP Enabler] CUSTOM_PASSWORD: ' + (customPass ? 'provided' : 'not provided'));
console.log('[Win RDP Enabler] USE_CUSTOM_USER: ' + useCustom);
console.log('[Win RDP Enabler] CUSTOM_USERNAME: ' + (username || 'not provided'));
console.log('[Win RDP Enabler] TAILSCALE HOSTNAME: ' + (hostname || 'default'));

// ============================================================
// VALIDATION
// ============================================================

if (!tailKey) {
    console.error('[Win RDP Enabler] ERROR: TAIL_KEY is not provided.');
    process.exit(1);
}

// ============================================================
// POWERSHELL SCRIPT
// ARM64 TAILSCALE MSI
// ============================================================

const ps = [
    '$ErrorActionPreference = "Stop"',
    '',
    '$tsKey = $env:TAIL_KEY',
    '$adminPass = $env:ADMIN_PASS',
    '$useCustom = $env:USE_CUSTOM_USER',
    '$username = $env:CUSTOM_USERNAME',
    '$customPass = $env:CUSTOM_PASSWORD',
    '$hostname = $env:HOSTNAME',
    '',
    '# ============================================================',
    '# 1. DOWNLOAD TAILSCALE ARM64',
    '# ============================================================',
    '',
    'Write-Host "Скачиваю Tailscale ARM64..."',
    '',
    '$installer = Join-Path $env:RUNNER_TEMP "tailscale-setup-arm64.msi"',
    '',
    'Invoke-WebRequest -Uri "https://pkgs.tailscale.com/stable/tailscale-setup-latest-arm64.msi" -OutFile $installer',
    '',
    'if (-not (Test-Path $installer)) {',
    '    throw "Tailscale ARM64 installer was not downloaded."',
    '}',
    '',
    '# ============================================================',
    '# 2. INSTALL TAILSCALE ARM64',
    '# ============================================================',
    '',
    'Write-Host "Устанавливаю Tailscale ARM64 в тихом режиме..."',
    '',
    '$installProcess = Start-Process -FilePath "msiexec.exe" -ArgumentList "/i", "`"$installer`"", "/quiet", "/norestart" -Wait -PassThru',
    '',
    'if ($installProcess.ExitCode -ne 0) {',
    '    throw "Tailscale ARM64 installer failed with exit code $($installProcess.ExitCode)"',
    '}',
    '',
    '# ============================================================',
    '# 3. AUTH TAILSCALE',
    '# ============================================================',
    '',
    '$tailscaleExe = "C:\\Program Files\\Tailscale\\tailscale.exe"',
    '',
    'if (-not (Test-Path $tailscaleExe)) {',
    '    throw "Tailscale executable not found: $tailscaleExe"',
    '}',
    '',
    'Write-Host "Запускаю Tailscale и настраиваю exit node..."',
    '',
    'if ([string]::IsNullOrWhiteSpace($hostname)) {',
    '',
    '    & $tailscaleExe up --authkey="$tsKey" --unattended --advertise-exit-node',
    '',
    '}',
    'else {',
    '',
    '    Write-Host "Использую имя Tailscale устройства: $hostname"',
    '',
    '    & $tailscaleExe up --authkey="$tsKey" --unattended --advertise-exit-node --hostname="$hostname"',
    '',
    '}',
    '',
    'if ($LASTEXITCODE -ne 0) {',
    '    throw "Tailscale authentication failed with exit code $LASTEXITCODE"',
    '}',
    '',
    '$tsIp = & $tailscaleExe ip -4',
    '',
    'Write-Host "=== TAILSCALE IP: $tsIp ===" -ForegroundColor Green',
    '',
    '# ============================================================',
    '# 4. RUNNERADMIN PASSWORD',
    '# ============================================================',
    '',
    'if (-not [string]::IsNullOrEmpty($adminPass)) {',
    '',
    '    Write-Host "Меняем пароль runneradmin..."',
    '',
    '    net user runneradmin "$adminPass"',
    '',
    '    if ($LASTEXITCODE -ne 0) {',
    '        throw "Failed to change runneradmin password."',
    '    }',
    '',
    '}',
    'else {',
    '',
    '    Write-Host "Пароль для runneradmin не указан."',
    '',
    '}',
    '',
    '# ============================================================',
    '# 5. CUSTOM USER',
    '# ============================================================',
    '',
    'if ($useCustom -eq "true" -and -not [string]::IsNullOrEmpty($username) -and -not [string]::IsNullOrEmpty($customPass)) {',
    '',
    '    Write-Host "Создаю кастомного пользователя: $username..."',
    '',
    '    $secPassword = ConvertTo-SecureString "$customPass" -AsPlainText -Force',
    '',
    '    New-LocalUser -Name $username -Password $secPassword -FullName "Cloud PC User" -Description "Custom Cloud PC Admin"',
    '',
    '    Add-LocalGroupMember -Group "Administrators" -Member $username',
    '',
    '}',
    '',
    '# ============================================================',
    '# 6. ENABLE RDP',
    '# ============================================================',
    '',
    'Write-Host "Включаю RDP..."',
    '',
    'Set-ItemProperty -Path "HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server" -Name "fDenyTSConnections" -Value 0',
    '',
    'Enable-NetFirewallRule -DisplayGroup "Remote Desktop"',
    '',
    '# ============================================================',
    '# 7. CLEANUP',
    '# ============================================================',
    '',
    'Remove-Item -Path $installer -Force -ErrorAction SilentlyContinue',
    '',
    'Write-Host "========================================"',
    'Write-Host "WIN RDP ENABLER READY"',
    'Write-Host "========================================" -ForegroundColor Green'
].join('\n');

// ============================================================
// RUN
// ============================================================

try {
    runPowerShell(ps);
} catch (error) {
    console.error('[Win RDP Enabler] Action failed.');
    console.error(error.message);
    process.exit(1);
}
