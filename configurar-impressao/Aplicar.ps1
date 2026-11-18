$ErrorActionPreference = 'Stop';
function Restore-State {
    param($state);
    foreach ($setting in $state.Policies) {
        if ($setting.Existed) { New-ItemProperty -Path $setting.Key -Name $setting.Name -Value $setting.Value -PropertyType DWord -Force | Out-Null } else { Remove-ItemProperty -LiteralPath $setting.Key -Name $setting.Name -ErrorAction SilentlyContinue };
    };
    $windowsKey = 'HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Windows';
    if ($state.LegacyExisted) { New-ItemProperty -Path $windowsKey -Name LegacyDefaultPrinterMode -Value $state.LegacyValue -PropertyType DWord -Force | Out-Null } else { Remove-ItemProperty -LiteralPath $windowsKey -Name LegacyDefaultPrinterMode -ErrorAction SilentlyContinue };
    if ($state.PreviousPrinter) { (New-Object -ComObject WScript.Network).SetDefaultPrinter($state.PreviousPrinter) };
};
$state = $null;
$changed = $false;
try {
    $folder = Join-Path $env:LOCALAPPDATA 'Limarques\ImpressaoDireta';
    $state = Get-Content -LiteralPath (Join-Path $folder 'pendente.json') -Raw | ConvertFrom-Json;
    $printer = Get-CimInstance Win32_Printer | Where-Object { $_.Name -eq $state.Printer -and ($_.Name -match 'EPSON' -or $_.DriverName -match 'EPSON') };
    if (!$printer -or $printer.WorkOffline) { throw 'A Epson nao esta disponivel. Execute Configurar-impressao-direta.cmd novamente.' };
    $backup = Join-Path $folder 'backup.json';
    if (!(Test-Path -LiteralPath $backup)) { $state | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $backup -Encoding UTF8 };
    $changed = $true;
    (New-Object -ComObject WScript.Network).SetDefaultPrinter($state.Printer);
    $windowsKey = 'HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Windows';
    if (!(Test-Path -LiteralPath $windowsKey)) { New-Item -Path $windowsKey | Out-Null };
    New-ItemProperty -Path $windowsKey -Name LegacyDefaultPrinterMode -Value 1 -PropertyType DWord -Force | Out-Null;
    foreach ($setting in $state.Policies) {
        if (!(Test-Path -LiteralPath $setting.Key)) { New-Item -Path $setting.Key | Out-Null };
        New-ItemProperty -Path $setting.Key -Name $setting.Name -Value $setting.Desired -PropertyType DWord -Force | Out-Null;
    };
    $width = if ([math]::Abs($state.Width - 58) -le 4) { 58 } else { 80 };
    Write-Host 'CONFIGURADO COM SUCESSO.' -ForegroundColor Green;
    Write-Host ('Impressora padrao: ' + $state.Printer);
    Write-Host ('No site, selecione Papel: ' + $width + ' mm uma unica vez.');
    Write-Host ('Feche e reabra o navegador que voce ja usa (' + ($state.Browsers -join ', ') + ').');
    Write-Host 'Depois, os botoes de imprimir enviarao o cupom direto para a Epson.';
    Write-Host 'A configuracao de impressao direta vale para todas as paginas destes navegadores neste usuario.';
    Write-Host 'Nenhuma impressao de teste foi enviada e nenhum dado de vendas foi alterado.';
} catch {
    Write-Host ('Falha: ' + $_.Exception.Message) -ForegroundColor Red;
    if ($changed) { try { Restore-State $state; Write-Host 'Configuracao anterior restaurada.' } catch { Write-Host 'Use Restaurar-impressao.cmd para restaurar a configuracao anterior.' } };
    exit 1;
};
