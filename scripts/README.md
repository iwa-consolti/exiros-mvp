# scripts — Utilidades de soporte

Scripts auxiliares (no productivos):

- **`tunnel.sh`** — Túnel HTTPS público hacia el backend local (Bloque 9.1, ADR-009).
  Expone `http://localhost:3000` como `https://<...>.trycloudflare.com` para que un
  **teléfono físico** o una red externa alcancen el backend en desarrollo/demo, sin
  desplegar a la nube ni costo ni cuenta. Requiere `brew install cloudflared`.
  Uso: `./scripts/tunnel.sh` (o `./scripts/tunnel.sh <puerto>`). El **emulador** NO lo
  necesita: usa `http://10.0.2.2:3000`. La URL cambia en cada arranque (quick tunnel).
- Seed de destinos para demo (pendiente).
- Simulador de ruta (reproduce GPX / mock locations) para la demo de cierre por
  geocerca (H3, Bloque 9.2 — pendiente).
