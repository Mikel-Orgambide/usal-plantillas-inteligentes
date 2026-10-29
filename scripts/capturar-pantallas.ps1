# Captura las pantallas de la app desde el teléfono (adb) para el espejo en Figma.
# Uso: cd "C:\Proyecto Final Tesis\repo"; .\scripts\capturar-pantallas.ps1
# Las capturas se hacen en el teléfono y se traen con adb pull (no pasan por la redirección de PowerShell, que corrompe binarios).
# Requiere: adb en el PATH y el Pixel conectado por cable (adb devices -> "device").

$ErrorActionPreference = "Stop"
$version = "0.11.0"
$dir = Join-Path $PSScriptRoot "..\docs\capturas\$version"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

$lista = (& adb devices 2>&1 | Out-String)
$conectados = [regex]::Matches($lista, "(?m)^\S+\s+device\s*$")
if ($conectados.Count -eq 0) {
  Write-Host "No hay teléfono autorizado. Salida de 'adb devices':" -ForegroundColor Red
  Write-Host $lista
  Write-Host "Si figura 'unauthorized', aceptá la depuración USB en el teléfono; si no figura nada, probá otro cable/puerto o activá la depuración USB." -ForegroundColor Yellow
  exit 1
}

# Nombre de archivo -> instrucción para llegar a la pantalla en el teléfono.
$pantallas = @(
  @{ n = "01-hoy-conectado";            t = "Hoy, con plantillas conectadas (o simulador activo)" },
  @{ n = "02-hoy-vacio";                t = "Hoy, sin sesiones guardadas (si no se puede, Enter para saltar)" },
  @{ n = "03-hoy-desconectado";         t = "Hoy, sin plantillas ni simulador" },
  @{ n = "04-nueva-sesion";             t = "Nueva sesión (preparación), con las seis posiciones reconocidas" },
  @{ n = "05-grabacion-grabando";       t = "Grabación en vivo, grabando" },
  @{ n = "06-grabacion-interrumpida";   t = "Grabación, conexión interrumpida (desenchufar la placa)" },
  @{ n = "07-grabacion-finalizar";      t = "Grabación, confirmación de Finalizar abierta" },
  @{ n = "08-detalle-arriba";           t = "Detalle de sesión, parte superior" },
  @{ n = "09-detalle-medio";            t = "Detalle de sesión, desplazado al medio (indicadores por posición)" },
  @{ n = "10-detalle-abajo";            t = "Detalle de sesión, final (gráfico y eventos)" },
  @{ n = "11-historial";               t = "Historial, con sesiones" },
  @{ n = "12-historial-dos-elegidas";   t = "Historial, dos sesiones marcadas para comparar" },
  @{ n = "13-historial-vacio";          t = "Historial vacío (si no se puede, Enter para saltar)" },
  @{ n = "14-comparacion";              t = "Comparación de dos sesiones compatibles" },
  @{ n = "15-comparacion-incompatible"; t = "Comparación no compatible (si no se puede, Enter para saltar)" },
  @{ n = "16-plantillas";               t = "Pestaña Plantillas (Bluetooth), sin buscar" },
  @{ n = "17-plantillas-buscando";      t = "Pestaña Plantillas, buscando / resultados" },
  @{ n = "18-ajustes";                  t = "Ajustes" },
  @{ n = "19-cuenta";                   t = "Pantalla de cuenta / inicio de sesión (Supabase)" },
  @{ n = "20-recuperada";               t = "Diálogo 'Sesión recuperada como incompleta' (si no se puede, Enter para saltar)" }
)

Write-Host "Carpeta: $dir"
Write-Host "Para cada pantalla: navegá en el teléfono, volvé a esta ventana y apretá Enter."
Write-Host "Escribí 's' + Enter para saltar una pantalla; 'q' para terminar." 
foreach ($p in $pantallas) {
  $r = Read-Host "`n[$($p.n)] $($p.t)"
  if ($r -eq "q") { break }
  if ($r -eq "s") { Write-Host "  saltada"; continue }
  $out = Join-Path $dir "$($p.n).png"
  $remoto = "/sdcard/Pictures/plantillas-capturas/$($p.n).png"
  & adb shell "mkdir -p /sdcard/Pictures/plantillas-capturas && screencap -p $remoto" | Out-Null
  & adb pull $remoto $out | Out-Null
  & adb shell "rm $remoto" | Out-Null
  $size = (Get-Item $out).Length
  Write-Host "  guardada ($([math]::Round($size/1KB)) KB)"
}
Write-Host "`nListo. Las capturas están en $dir"
