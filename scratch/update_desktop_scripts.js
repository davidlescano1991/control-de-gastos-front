const fs = require('fs');

// 1. Update launcher.ps1
const launcherPath = 'C:/Datos/David/Proyectos/Control_Gastos/scripts/launcher.ps1';
const launcherContent = `# ==============================================================================
# Control de Gastos - Lanzador y Administrador Principal
# ==============================================================================
$Host.UI.RawUI.WindowTitle = "Control de Gastos - Gestor Local"

$scriptsDir = "C:\\Datos\\David\\Proyectos\\Control_Gastos\\scripts"

function Test-PortListening([int]$port) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    return ($null -ne $conn)
}

function Show-Dashboard {
    Clear-Host
    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host "          💳 CONTROL DE GASTOS - GESTOR DE ENTORNO LOCAL              " -ForegroundColor Yellow
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host ""
    
    $p5432 = Test-PortListening 5432
    $p8080 = Test-PortListening 8080
    $p5555 = Test-PortListening 5555
    $p4202 = Test-PortListening 4202
    $p4200 = Test-PortListening 4200
    
    Write-Host " Estado en tiempo real de los servicios:" -ForegroundColor White
    
    if ($p5432) {
        Write-Host "   [✔] PostgreSQL en Docker (Puerto 5432):     " -NoNewline -ForegroundColor Green
        Write-Host "EN LÍNEA" -ForegroundColor Green
    } else {
        Write-Host "   [✖] PostgreSQL en Docker (Puerto 5432):     " -NoNewline -ForegroundColor Red
        Write-Host "DETENIDO" -ForegroundColor Red
    }
    
    if ($p8080) {
        Write-Host "   [✔] API REST Backend (Puerto 8080):         " -NoNewline -ForegroundColor Green
        Write-Host "EN LÍNEA" -ForegroundColor Green
    } else {
        Write-Host "   [✖] API REST Backend (Puerto 8080):         " -NoNewline -ForegroundColor Red
        Write-Host "DETENIDO" -ForegroundColor Red
    }
    
    if ($p5555) {
        Write-Host "   [✔] Prisma Studio (Puerto 5555):            " -NoNewline -ForegroundColor Green
        Write-Host "EN LÍNEA" -ForegroundColor Green
    } else {
        Write-Host "   [✖] Prisma Studio (Puerto 5555):            " -NoNewline -ForegroundColor Red
        Write-Host "DETENIDO" -ForegroundColor Red
    }
    
    if ($p4202) {
        Write-Host "   [✔] Frontend Moderno 2.0 (Puerto 4202):     " -NoNewline -ForegroundColor Green
        Write-Host "EN LÍNEA" -ForegroundColor Green
    } else {
        Write-Host "   [✖] Frontend Moderno 2.0 (Puerto 4202):     " -NoNewline -ForegroundColor Red
        Write-Host "DETENIDO" -ForegroundColor Red
    }

    if ($p4200) {
        Write-Host "   [✔] Frontend Original 1.0 (Puerto 4200):    " -NoNewline -ForegroundColor Green
        Write-Host "EN LÍNEA" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "----------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "  [1] Iniciar Todo (Docker + API + Prisma + Frontend Moderno 4202)" -ForegroundColor Green
    Write-Host "  [2] Detener Todo (Apagar servicios y liberar puertos)" -ForegroundColor Red
    Write-Host "  [3] Reiniciar Todo" -ForegroundColor Yellow
    Write-Host "  [4] Abrir Frontend Moderno en Navegador (http://localhost:4202)" -ForegroundColor Cyan
    Write-Host "  [5] Abrir Prisma Studio en Navegador (http://localhost:5555)" -ForegroundColor Cyan
    if ($p4200) {
        Write-Host "  [6] Abrir Frontend Original 1.0 en Navegador (http://localhost:4200)" -ForegroundColor Yellow
    }
    Write-Host "  [0] Salir" -ForegroundColor Gray
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host ""
}

while ($true) {
    Show-Dashboard
    $opcion = Read-Host " Seleccione una opción [1-6 o 0]"
    
    switch ($opcion) {
        "1" {
            & "$scriptsDir\\iniciar-servicios.ps1"
        }
        "2" {
            & "$scriptsDir\\detener-servicios.ps1"
            Read-Host "Presione Enter para volver al menú..."
        }
        "3" {
            & "$scriptsDir\\detener-servicios.ps1"
            Start-Sleep -Seconds 1
            & "$scriptsDir\\iniciar-servicios.ps1"
        }
        "4" {
            Start-Process "http://localhost:4202"
        }
        "5" {
            Start-Process "http://localhost:5555"
        }
        "6" {
            Start-Process "http://localhost:4200"
        }
        "0" {
            Write-Host "Hasta luego!" -ForegroundColor Green
            Start-Sleep -Milliseconds 800
            return
        }
        default {
            Write-Host "Opción inválida. Intente de nuevo." -ForegroundColor Yellow
            Start-Sleep -Seconds 1
        }
    }
}
`;
fs.writeFileSync(launcherPath, launcherContent, 'utf8');
console.log('launcher.ps1 updated with port 4202');

// 2. Fix title in iniciar-servicios.ps1
const iniPath = 'C:/Datos/David/Proyectos/Control_Gastos/scripts/iniciar-servicios.ps1';
let ini = fs.readFileSync(iniPath, 'utf8');
ini = ini.replace(
  "[Frontend] Control de Gastos (4200)",
  "[Frontend] Control de Gastos (4202)"
);
fs.writeFileSync(iniPath, ini, 'utf8');
console.log('iniciar-servicios.ps1 title updated');
