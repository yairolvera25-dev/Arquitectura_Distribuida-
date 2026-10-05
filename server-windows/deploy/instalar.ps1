# Configura el servidor uno para la API de clima. Ejecutar en PowerShell como Administrador
# dentro de la carpeta server-windows:  powershell -ExecutionPolicy Bypass -File deploy\instalar.ps1

$ErrorActionPreference = 'Stop'
$carpeta = Split-Path -Parent $PSScriptRoot

# 1. Firewall: puerto 3000 abierto solo para la red ZeroTier del equipo.
if (-not (Get-NetFirewallRule -DisplayName 'API Clima UPP 3000' -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName 'API Clima UPP 3000' -Direction Inbound -Protocol TCP `
    -LocalPort 3000 -RemoteAddress 10.191.84.0/24 -Action Allow | Out-Null
  Write-Host 'Regla de firewall creada (TCP 3000 desde 10.191.84.0/24).'
}

# 2. Tarea programada: arranca la API al encender el servidor, aunque nadie inicie sesión.
$node = (Get-Command node).Source
$accion = New-ScheduledTaskAction -Execute $node -Argument 'src\index.js' -WorkingDirectory $carpeta
$disparador = New-ScheduledTaskTrigger -AtStartup
$ajustes = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero)
# El nombre de la cuenta Network Service cambia con el idioma de Windows; el SID no.
$cuenta = ([Security.Principal.SecurityIdentifier]'S-1-5-20').Translate([Security.Principal.NTAccount]).Value
Register-ScheduledTask -TaskName 'API Clima UPP' -Action $accion -Trigger $disparador -Settings $ajustes `
  -User $cuenta -Force | Out-Null
Start-ScheduledTask -TaskName 'API Clima UPP'
Write-Host 'API registrada como tarea de inicio y en ejecución.'
