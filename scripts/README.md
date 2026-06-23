# scripts — Utilidades de soporte

Scripts auxiliares (no productivos):

- **`tunnel.sh`** — Túnel HTTPS público hacia el backend local (Bloque 9.1, ADR-009).
  Expone `http://localhost:3000` como `https://<...>.trycloudflare.com` para que un
  **teléfono físico** o una red externa alcancen el backend en desarrollo/demo, sin
  desplegar a la nube ni costo ni cuenta. Requiere `brew install cloudflared`.
  Uso: `./scripts/tunnel.sh` (o `./scripts/tunnel.sh <puerto>`). El **emulador** NO lo
  necesita: usa `http://10.0.2.2:3000`. La URL cambia en cada arranque (quick tunnel).
- **`route-sim.sh`** — Simulador de ruta para la demo (Bloque 9.2, riesgo H3).
  Mueve el GPS del **emulador** por una ruta interpolada `from→to` con `adb emu geo fix`
  (lng primero), terminando en el centro de una geocerca para disparar el **cierre
  automático**. Con un viaje EN_RUTA en la app reproduce el flujo real: captura → lote →
  cierre AUTO_GEOFENCE. `--dry-run` previsualiza la ruta y distancias sin emulador.
  Ej.: `./scripts/route-sim.sh --dry-run` · `./scripts/route-sim.sh --to 25.687,-100.316 --radius 300`.
- Seed de destinos para demo (pendiente).
