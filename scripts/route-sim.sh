#!/usr/bin/env bash
#
# route-sim.sh — Simulador de ruta para la demo (Bloque 9.2, riesgo H3).
#
# Mueve el GPS del EMULADOR Android a lo largo de una ruta interpolada de un punto
# de origen a un destino, usando `adb emu geo fix`. Con un viaje EN_RUTA en la app,
# esto reproduce el flujo real de la demo: la app captura los fixes -> los sube por
# lotes -> el backend cierra el viaje por geocerca cuando el camión entra al radio.
#
# Por qué `adb emu geo fix` y no GPX: en este AVD ARM el "Set Location" de Extended
# Controls está roto; `geo fix` (lng PRIMERO) es el método que sí alimenta a
# FusedLocation (que en la app corre en HIGH_ACCURACY para verlo). Ver CONTEXT-AI.
#
# Uso:
#   ./scripts/route-sim.sh                       # ruta por defecto hacia el patio Monterrey
#   ./scripts/route-sim.sh --dry-run             # solo imprime la ruta (sin emulador)
#   ./scripts/route-sim.sh --to 25.687,-100.316 --radius 300
#   ./scripts/route-sim.sh --from 25.70,-100.33 --to 25.687,-100.316 --steps 16 --delay 4
#
# Flags:
#   --from LAT,LNG   origen           (def 25.7005,-100.3300, ~2 km del destino)
#   --to   LAT,LNG   destino/centro   (def 25.6870,-100.3160 = "Patio Comprador Monterrey")
#   --steps N        nº de puntos     (def 12)
#   --delay S        seg entre puntos (def 5; debe ser <= intervalo de captura de la app)
#   --radius M       radio geocerca   (def 300; solo para avisar "DENTRO" en la salida)
#   --serial ID      serial adb       (def: primer emulator-* en `adb devices`)
#   --dry-run        no toca el emulador; imprime la ruta y distancias
#
# Requisitos (salvo --dry-run): emulador corriendo + la app con un viaje EN_RUTA hacia
# ESE destino. adb se toma de $ADB o de ~/Library/Android/sdk/platform-tools/adb.
#
set -euo pipefail

FROM="25.7005,-100.3300"
TO="25.6870,-100.3160"
STEPS=12
DELAY=5
RADIUS=300
SERIAL=""
DRY_RUN=0
ADB="${ADB:-$HOME/Library/Android/sdk/platform-tools/adb}"

usage() { sed -n '2,/^set -euo/p' "$0" | sed 's/^# \{0,1\}//; s/^#//' | grep -v '^set -euo'; }

while [ $# -gt 0 ]; do
  case "$1" in
    --from)   FROM="$2";   shift 2;;
    --to)     TO="$2";     shift 2;;
    --steps)  STEPS="$2";  shift 2;;
    --delay)  DELAY="$2";  shift 2;;
    --radius) RADIUS="$2"; shift 2;;
    --serial) SERIAL="$2"; shift 2;;
    --dry-run) DRY_RUN=1;  shift;;
    -h|--help) usage; exit 0;;
    *) echo "Argumento desconocido: $1" >&2; echo "Usa --help." >&2; exit 1;;
  esac
done

FROM_LAT="${FROM%,*}"; FROM_LNG="${FROM#*,}"
TO_LAT="${TO%,*}";     TO_LNG="${TO#*,}"

if [ "$DRY_RUN" -eq 0 ]; then
  [ -x "$ADB" ] || { echo "ERROR: adb no ejecutable en '$ADB' (define ADB=/ruta/adb)." >&2; exit 1; }
  EMU=$("$ADB" devices | awk '/^emulator-/{print $1; exit}')
  [ -n "$EMU" ] || { echo "ERROR: no hay emulador en ejecución. Arráncalo primero (ver CONTEXT-AI 'CÓMO LEVANTAR')." >&2; exit 1; }
  [ -z "$SERIAL" ] && SERIAL="$EMU"
  echo "Emulador: $SERIAL"
fi

echo "Ruta: ($FROM_LAT,$FROM_LNG) -> ($TO_LAT,$TO_LNG) | $STEPS pasos | ${DELAY}s c/u | radio ${RADIUS}m"
[ "$DRY_RUN" -eq 1 ] && echo "(DRY-RUN: no se envía nada al emulador)"
echo

i=1
while [ "$i" -le "$STEPS" ]; do
  # Interpola el punto i y calcula distancia haversine al destino (en awk: floats + trig).
  read -r LAT LNG DIST <<EOF
$(awk -v fla="$FROM_LAT" -v flo="$FROM_LNG" -v tla="$TO_LAT" -v tlo="$TO_LNG" -v i="$i" -v n="$STEPS" '
  function rad(x){return x*3.141592653589793/180}
  BEGIN{
    f=i/n;
    lat=fla+(tla-fla)*f; lng=flo+(tlo-flo)*f;
    dlat=rad(tla-lat); dlng=rad(tlo-lng);
    a=sin(dlat/2)^2 + cos(rad(lat))*cos(rad(tla))*sin(dlng/2)^2;
    d=2*6371000*atan2(sqrt(a), sqrt(1-a));
    printf "%.6f %.6f %.0f", lat, lng, d;
  }')
EOF
  INSIDE=""
  if awk -v d="$DIST" -v r="$RADIUS" 'BEGIN{exit !(d<=r)}'; then
    INSIDE="  [DENTRO de geocerca → dispara cierre automático]"
  fi
  printf "  %2d/%-2d  lat=%s lng=%s  (%4sm al destino)%s\n" "$i" "$STEPS" "$LAT" "$LNG" "$DIST" "$INSIDE"

  if [ "$DRY_RUN" -eq 0 ]; then
    "$ADB" -s "$SERIAL" emu geo fix "$LNG" "$LAT"   # OJO: longitud PRIMERO, luego latitud.
    sleep "$DELAY"
  fi
  i=$((i + 1))
done

echo
echo "Ruta completada. Con un viaje EN_RUTA hacia este destino, el backend debe cerrarlo (AUTO_GEOFENCE)."
