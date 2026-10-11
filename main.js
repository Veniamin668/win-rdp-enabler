const { execFileSync } = require('child_process');

function runPowerShell(script) {
    const buffer = Buffer.from(script, 'utf16le');
    const encodedCommand = buffer.toString('base64');

    execFileSync(
        'pwsh.exe',
        [
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy',
            'Bypass',
            '-EncodedCommand',
            encodedCommand
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
const oauthKey = process.env.INPUT_OAUTH_KEY || ''; // ДОБАВЛЕН OAUTH ДЛЯ ARM
const adminPass = process.env.INPUT_ADMIN_PASS || '';
const customPass = process.env.INPUT_CUSTOM_PASSWORD || '';
const useCustom = process.env.INPUT_USE_CUSTOM_USER || 'false';
const username = process.env.INPUT_CUSTOM_USERNAME || '';
const hostname = process.env.INPUT_HOSTNAME || '';
const tags = process.env.INPUT_ADVERTISE_TAGS || '';

// ============================================================
// MASK SECRETS
// ============================================================

function maskSecret(value) {
    if (value) {
        process.stdout.write('::add-mask::' + value + '\n');
    }
}

maskSecret(tailKey);
maskSecret(oauthKey);
maskSecret(adminPass);
maskSecret(customPass);

// ============================================================
// LOG INPUT STATUS WITHOUT EXPOSING VALUES
// ============================================================

console.log('[Win RDP Enabler] Secrets masked.');

console.log(
    '[Win RDP Enabler] TAIL_KEY (Legacy): ' +
    (tailKey ? 'provided' : 'not provided')
);

console.log(
    '[Win RDP Enabler] OAUTH_KEY (New): ' +
    (oauthKey ? 'provided' : 'not provided')
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

console.log(
    '[Win RDP Enabler] ADVERTISE_TAGS: ' +
    (tags || 'not provided')
);

// ============================================================
// VALIDATION
// ============================================================

if (!tailKey && !oauthKey) {
    console.error(
        '[Win RDP Enabler] ERROR: Either TAIL_KEY or OAUTH_KEY input must be provided.'
    );

    process.exit(1);
}

// ============================================================
// POWERSHELL 7
// ============================================================

const ps = [
    '$ErrorActionPreference = "Stop"',
    '',
    '$tsKey =$env:INPUT_TAIL_KEY',
    '$oauthKey =$env:INPUT_OAUTH_KEY',
    '$adminPass =$env:INPUT_ADMIN_PASS',
    '$customPass =$env:INPUT_CUSTOM_PASSWORD',
    '$useCustom =$env:INPUT_USE_CUSTOM_USER',
    '$username =$env:INPUT_CUSTOM_USERNAME',
    '$hostname =$env:INPUT_HOSTNAME',
    '$tags =$env:INPUT_ADVERTISE_TAGS',
    '',
    '# ============================================================',
    '# DOWNLOAD TAILSCALE ARM64',
    '# ============================================================',
    '',
    'Write-Host "Скачиваю Tailscale ARM64..."',
    '',
    '$installer = Join-Path$env:RUNNER_TEMP "tailscale-setup-latest-arm64.msi"',
    '',
    'Invoke-WebRequest -Uri "https://pkgs.tailscale.com/stable/tailscale-setup-latest-arm64.msi" -OutFile $installer',
    '',
    'if (-not (Test-Path $installer)) {',
    '    throw "Tailscale ARM64 installer was not downloaded."',
    '}',
    '',
    '# ============================================================',
    '# INSTALL TAILSCALE ARM64',
    '# ============================================================',
    '',
    'Write-Host "Устанавливаю Tailscale ARM64..."',
    '',
    '$installProcess = Start-Process `',
    '    -FilePath "msiexec.exe" `',
    '    -ArgumentList "/i", "`"$installer`"", "/quiet", "/norestart" `',
    '    -Wait `',
    '    -PassThru',
    '',
    'if ($installProcess.ExitCode -ne 0) {',
    '    throw "Tailscale ARM64 installer failed with exit code $($installProcess.ExitCode)"',
    '}',
    '',
    '$tailscaleExe = "C:\\Program Files\\Tailscale\\tailscale.exe"',
    '',
    'if (-not (Test-Path $tailscaleExe)) {',
    '    throw "Tailscale executable not found: $tailscaleExe"',
    '}',
    '',
    '# ============================================================',
    '# TAILSCALE AUTH (Гибридный режим для ARM)',
    '# ============================================================',
    '',
    '$finalAuthKey = ""',
    'if (-not [string]::IsNullOrWhiteSpace($oauthKey)) {',
    '    Write-Host "Используется авторизация через новый OAuth токен..."',
    '    $finalAuthKey =$oauthKey',
    '} else {',
    '    Write-Host "Используется старая логика авторизации через TAIL_KEY..."',
    '    $finalAuthKey =$tsKey',
    '}',
    '',
    'Write-Host "Запускаю Tailscale и настраиваю exit node..."',
    '',
    '$tailscaleArgs = @("up", "--authkey=$finalAuthKey", "--unattended", "--advertise-exit-node")',
    '',
    'if (-not [string]::IsNullOrWhiteSpace($tags)) {',
    '    Write-Host "Используются теги: $tags"',
    '    $tailscaleArgs += "--advertise-tags=$tags"',
    '}',
    '',
    'if (-not [string]::IsNullOrWhiteSpace($hostname)) {',
    '    Write-Host "Использую hostname: $hostname"',
    '    $tailscaleArgs += "--hostname=$hostname"',
    '}',
    '',
    '& $tailscaleExe @tailscaleArgs',
    '',
    'if ($LASTEXITCODE -ne 0) {',
    '    throw "Tailscale authentication failed with exit code $LASTEXITCODE"',
    '}',
    '',
    '$tsIp = &$tailscaleExe ip -4',
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
    'Write-Host "WIN RDP ENABLER READY FOR ARM64"',
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
