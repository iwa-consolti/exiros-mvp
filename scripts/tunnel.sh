#!/usr/bin/env bash
#
# tunnel.sh — Túnel HTTPS público hacia el backend local (Bloque 9.1, ADR-009 / D2).
#
# Abre un "quick tunnel" de Cloudflare contra el backend que corre en local
# (por defecto http://localhost:3000) y expone una URL pública https://<algo>.trycloudflare.com.
# Sirve para que un TELÉFONO FÍSICO (o cualquier red externa) alcance el backend
# durante desarrollo/demo, sin desplegar a la nube y sin costo ni cuenta.
#
# El EMULADOR Android NO necesita túnel: usa http://10.0.2.2:3000 (alias del host).
# El túnel es para el teléfono físico o para enseñar la demo desde otra red.
#
# Requisitos:
#   - cloudflared instalado:  brew install cloudflared
#   - el backend ya corriendo en el puerto destino (ver CONTEXT-AI "CÓMO LEVANTAR").
#
# Uso:
#   ./scripts/tunnel.sh            # túnel contra http://localhost:3000
#   ./scripts/tunnel.sh 8080       # túnel contra http://localhost:8080
#
# El comando queda en primer plano imprimiendo la URL pública; Ctrl-C lo cierra.
# La URL cambia en cada arranque (quick tunnel = efímero, sin cuenta).
#
set -euo pipefail

PORT="${1:-3000}"
TARGET="http://localhost:${PORT}"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "ERROR: cloudflared no está instalado." >&2
  echo "       Instálalo con:  brew install cloudflared" >&2
  exit 1
fi

# Aviso si el backend no responde en el puerto (no aborta: el túnel puede abrirse antes).
if ! curl -s -o /dev/null --max-time 2 "${TARGET}"; then
  echo "AVISO: ${TARGET} no respondió todavía. Levanta el backend antes de usar la URL pública." >&2
fi

echo "Abriendo túnel Cloudflare hacia ${TARGET} ..."
echo "Copia la URL https://<...>.trycloudflare.com que aparece abajo y úsala como base de la app."
echo "Ctrl-C para cerrar el túnel."
echo

exec cloudflared tunnel --url "${TARGET}"
