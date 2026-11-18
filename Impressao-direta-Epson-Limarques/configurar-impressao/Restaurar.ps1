$ErrorActionPreference = 'Stop';
try {
    $backup = Join-Path $env:LOCALAPPDATA 'Limarques\ImpressaoDireta\backup.json';
    if (!(Test-Path -LiteralPath $backup)) { throw 'Nenhuma configuracao anterior foi encontrada neste usuario.' };
    $state = Get-Content -LiteralPath $backup -Raw | ConvertFrom-Json;
    foreach ($setting in $state.Policies) {
        if ($setting.Existed) { New-ItemProperty -Path $setting.Key -Name $setting.Name -Value $setting.Value -PropertyType DWord -Force | Out-Null } else { Remove-ItemProperty -LiteralPath $setting.Key -Name $setting.Name -ErrorAction SilentlyContinue };
    };
    $windowsKey = 'HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Windows';
    if ($state.LegacyExisted) { New-ItemProperty -Path $windowsKey -Name LegacyDefaultPrinterMode -Value $state.LegacyValue -PropertyType DWord -Force | Out-Null } else { Remove-ItemProperty -LiteralPath $windowsKey -Name LegacyDefaultPrinterMode -ErrorAction SilentlyContinue };
    if ($state.PreviousPrinter) { (New-Object -ComObject WScript.Network).SetDefaultPrinter($state.PreviousPrinter) };
    Write-Host 'Configuracao anterior restaurada. Feche e reabra o navegador.' -ForegroundColor Green;
} catch { Write-Host $_.Exception.Message -ForegroundColor Yellow; exit 1 };
