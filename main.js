const { execFileSync } = require('child_process');

function runPowerShell(script) {
    execFileSync(
        'pwsh.exe',
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
            windowsHide: true,
            env: process.env
        }
    );
}

// ============================================================
// INPUTS
// ============================================================

const tailKey = process.env.INPUT_TAIL_KEY || '';
const adminPass = process.env.INPUT_ADMIN_PASS || '';
const customPass = process.env.INPUT_CUSTOM_PASSWORD || '';
const useCustom = process.env.INPUT_USE_CUSTOM_USER || 'false';
const username = process.env.INPUT_CUSTOM_USERNAME || '';
const hostname = process.env.INPUT_HOSTNAME || '';

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

// ============================================================
// LOG INPUT STATUS WITHOUT EXPOSING VALUES
// ============================================================

console.log('[Win RDP Enabler] Secrets masked.');

console.log(
    '[Win RDP Enabler] TAIL_KEY: ' +
    (tailKey ? 'provided' : 'not provided')
);

console.log(
    '[Win RDP Enabler] ADMIN_PASS: ' +
    (adminPass ? 'provided' : 'not provided')
);

console.log(
    '[Win RDP Enabler] CUSTOM_PASSWORD: ' +
    (customPass ? 'provided' : 'not provided')
);

console.log(
    '[Win RDP Enabler] USE_CUSTOM_USER: ' +
    useCustom
);

console.log(
    '[Win RDP Enabler] CUSTOM_USERNAME: ' +
    (username || 'not provided')
);

console.log(
    '[Win RDP Enabler] HOSTNAME: ' +
    (hostname || 'default')
);

// ============================================================
// VALIDATION
// ============================================================

if (!tailKey) {
    console.error(
        '[Win RDP Enabler] ERROR: TAIL_KEY input is required.'
    );

    process.exit(1);
}

// ============================================================
// POWERSHELL 7
// ============================================================

const ps = [
    '$ErrorActionPreference = "Stop"',
    '',
    '$tsKey = $env:INPUT_TAIL_KEY',
    '$adminPass = $env:INPUT_ADMIN_PASS',
    '$customPass = $env:INPUT_CUSTOM_PASSWORD',
    '$useCustom = $env:INPUT_USE_CUSTOM_USER',
    '$username = $env:INPUT_CUSTOM_USERNAME',
    '$hostname = $env:INPUT_HOSTNAME',
    '',
    '# ============================================================',
    '# DOWNLOAD TAILSCALE',
    '# ============================================================',
    '',
    'Write-Host "Скачиваю Tailscale..."',
    '',
    '$installer = Join-Path $env:RUNNER_TEMP "tailscale-setup.exe"',
    '',
    'Invoke-WebRequest -Uri "https://pkgs.tailscale.com/stable/tailscale-setup-latest.exe" -OutFile $installer',
    '',
    'if (-not (Test-Path $installer)) {',
    '    throw "Tailscale installer was not downloaded."',
    '}',
    '',
    '# ============================================================',
    '# INSTALL TAILSCALE',
    '# ============================================================',
    '',
    'Write-Host "Устанавливаю Tailscale..."',
    '',
    '$installProcess = Start-Process `',
    '    -FilePath $installer `',
    '    -ArgumentList "/quiet", "/norestart" `',
    '    -Wait `',
    '    -PassThru',
    '',
    'if ($installProcess.ExitCode -ne 0) {',
    '    throw "Tailscale installer failed with exit code $($installProcess.ExitCode)"',
    '}',
    '',
    '$tailscaleExe = "C:\\Program Files\\Tailscale\\tailscale.exe"',
    '',
    'if (-not (Test-Path $tailscaleExe)) {',
    '    throw "Tailscale executable not found: $tailscaleExe"',
    '}',
    '',
    '# ============================================================',
    '# TAILSCALE AUTH',
    '# ============================================================',
    '',
    'Write-Host "Запускаю Tailscale и настраиваю exit node..."',
    '',
    'if ([string]::IsNullOrWhiteSpace($hostname)) {',
    '',
    '    & $tailscaleExe up `',
    '        --authkey="$tsKey" `',
    '        --unattended `',
    '        --advertise-exit-node',
    '',
    '}',
    'else {',
    '',
    '    Write-Host "Использую hostname: $hostname"',
    '',
    '    & $tailscaleExe up `',
    '        --authkey="$tsKey" `',
    '        --unattended `',
    '        --advertise-exit-node `',
    '        --hostname="$hostname"',
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
    '# RUNNERADMIN PASSWORD',
    '# ============================================================',
    '',
    'if (-not [string]::IsNullOrEmpty($adminPass)) {',
    '',
    '    Write-Host "Меняю пароль runneradmin..."',
    '',
    '    net user runneradmin "$adminPass"',
    '',
    '    if ($LASTEXITCODE -ne 0) {',
    '        throw "Failed to change runneradmin password."',
    '    }',
    '}',
    '',
    '# ============================================================',
    '# CUSTOM USER',
    '# ============================================================',
    '',
    'if (',
    '    $useCustom -eq "true" -and',
    '    -not [string]::IsNullOrEmpty($username) -and',
    '    -not [string]::IsNullOrEmpty($customPass)',
    ') {',
    '',
    '    Write-Host "Создаю кастомного пользователя: $username..."',
    '',
    '    $secPassword = ConvertTo-SecureString `',
    '        "$customPass" `',
    '        -AsPlainText `',
    '        -Force',
    '',
    '    New-LocalUser `',
    '        -Name $username `',
    '        -Password $secPassword `',
    '        -FullName "Cloud PC User" `',
    '        -Description "Custom Cloud PC Admin"',
    '',
    '    Add-LocalGroupMember `',
    '        -Group "Administrators" `',
    '        -Member $username',
    '}',
    '',
    '# ============================================================',
    '# ENABLE RDP',
    '# ============================================================',
    '',
    'Write-Host "Включаю RDP..."',
    '',
    'Set-ItemProperty `',
    '    -Path "HKLM:\\System\\CurrentControlSet\\Control\\Terminal Server" `',
    '    -Name "fDenyTSConnections" `',
    '    -Value 0',
    '',
    'Enable-NetFirewallRule -DisplayGroup "Remote Desktop"',
    '',
    '# ============================================================',
    '# CLEANUP',
    '# ============================================================',
    '',
    'Remove-Item $installer -Force -ErrorAction SilentlyContinue',
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
