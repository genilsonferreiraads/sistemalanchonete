$ErrorActionPreference = 'Stop';
try {
    $printers = @(Get-CimInstance Win32_Printer);
    $epsons = @($printers | Where-Object { $_.Name -match 'EPSON' -or $_.DriverName -match 'EPSON' });
    if (!$epsons.Count) { throw 'Epson nao encontrada. Execute este configurador no PC da lanchonete, com o driver da Epson instalado.' };
    $printer = $epsons | Where-Object Default | Select-Object -First 1;
    if (!$printer -and $epsons.Count -eq 1) { $printer = $epsons[0] };
    if (!$printer) {
        for ($i = 0; $i -lt $epsons.Count; $i++) { Write-Host (($i + 1).ToString() + ' - ' + $epsons[$i].Name) };
        $choice = 0;
        if (![int]::TryParse((Read-Host 'Numero da Epson de cupons'), [ref]$choice) -or $choice -lt 1 -or $choice -gt $epsons.Count) { throw 'Selecao de impressora invalida.' };
        $printer = $epsons[$choice - 1];
    };
    if ($printer.WorkOffline) { throw 'A Epson esta marcada como offline. Conecte a impressora e tente novamente.' };
    Add-Type -AssemblyName System.Drawing;
    $settings = New-Object System.Drawing.Printing.PrinterSettings;
    $settings.PrinterName = $printer.Name;
    $width = [math]::Round($settings.DefaultPageSettings.PaperSize.Width * 25.4 / 100, 1);
    if ([math]::Abs($width - 58) -gt 4 -and [math]::Abs($width - 80) -gt 4) { throw ('O driver informa papel de ' + $width + ' mm. Nas preferencias de impressao da Epson, selecione a bobina de 58 ou 80 mm e execute novamente.') };
    $definitions = @(@('Edge', 'Microsoft\Edge', 'Microsoft\Edge\Application\msedge.exe'), @('Chrome', 'Google\Chrome', 'Google\Chrome\Application\chrome.exe'));
    $policies = @();
    $browsers = @();
    foreach ($definition in $definitions) {
        $relative = $definition[2];
        $roots = @(${env:ProgramFiles(x86)}, $env:ProgramFiles, $env:LOCALAPPDATA) | Where-Object { $_ };
        $paths = @($roots | ForEach-Object { Join-Path $_ $relative });
        $exe = $paths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1;
        if (!$exe) { continue };
        if ((Get-Item -LiteralPath $exe).VersionInfo.FileMajorPart -lt 144) { throw ('Atualize o ' + $definition[0] + ' para a versao 144 ou superior e tente novamente.') };
        $key = 'HKCU:\Software\Policies\' + $definition[1];
        $machineKey = 'HKLM:\Software\Policies\' + $definition[1];
        foreach ($setting in @(@('SilentPrintingEnabled', 1), @('PrintHeaderFooter', 0), @('PrintPreviewUseSystemDefaultPrinter', 1))) {
            $machineValue = Get-ItemProperty -LiteralPath $machineKey -Name $setting[0] -ErrorAction SilentlyContinue;
            if ($machineValue -and $machineValue.($setting[0]) -ne $setting[1]) { throw ('O administrador do PC controla a opcao ' + $setting[0] + '. Solicite a configuracao a ele.') };
            $old = Get-ItemProperty -LiteralPath $key -Name $setting[0] -ErrorAction SilentlyContinue;
            $policies += [pscustomobject]@{ Key = $key; Name = $setting[0]; Desired = $setting[1]; Existed = [bool]$old; Value = $(if ($old) { $old.($setting[0]) } else { $null }) };
        };
        $browsers += $definition[0];
    };
    if (!$browsers.Count) { throw 'Chrome ou Edge nao encontrado. Instale ou atualize o navegador antes de configurar.' };
    $windowsKey = 'HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Windows';
    $legacy = Get-ItemProperty -LiteralPath $windowsKey -Name LegacyDefaultPrinterMode -ErrorAction SilentlyContinue;
    $state = [pscustomobject]@{ Printer = $printer.Name; Width = $width; Browsers = $browsers; PreviousPrinter = ($printers | Where-Object Default | Select-Object -First 1).Name; Policies = $policies; LegacyExisted = [bool]$legacy; LegacyValue = $(if ($legacy) { $legacy.LegacyDefaultPrinterMode } else { $null }) };
    $folder = Join-Path $env:LOCALAPPDATA 'Limarques\ImpressaoDireta';
    New-Item -ItemType Directory -Path $folder -Force | Out-Null;
    $state | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $folder 'pendente.json') -Encoding UTF8;
    Write-Host ('Epson: ' + $printer.Name + ' | Bobina: ' + $width + ' mm');
} catch { Write-Host ('NAO CONFIGURADO: ' + $_.Exception.Message) -ForegroundColor Yellow; exit 1 };
