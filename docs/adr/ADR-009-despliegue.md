# ADR-009 — Despliegue (D2)

- **Estado:** ✅ Aceptado (2026-06-18, default asumido — **pend. confirmar con Julio** que un deploy gratis no choca con "cloud no requerido")
- **Decide:** cómo el dispositivo (emulador/teléfono) alcanza el backend en desarrollo y en la demo.

## Contexto
El dispositivo necesita un backend **alcanzable por internet**. El doc dice que el **cloud NO es requisito** (no está prohibido, solo no obligatorio). Riesgo a evitar: que la **demo dependa de la laptop + red local**.

## Decisión
**Túnel en desarrollo + deploy gratis en la demo.**
- **Desarrollo:** backend local + **túnel (cloudflared)** para que el dispositivo lo alcance.
- **Demo:** **deploy gratis (Railway/Render)** + Postgres administrado → **URL estable, independiente de la laptop**.
- **Web:** build estático servido por el mismo backend o **Vercel/Netlify gratis**.
- **Fotos:** volumen local del backend (MVP, ver stack).

## Alternativas consideradas
- **Solo túnel (sin deploy):** la URL cambia y la demo depende de la laptop encendida + red. Sirve para dev, no para una demo robusta.
- **Cloud formal / Kubernetes / CD:** sobreingeniería; el proyecto los marca como no requeridos.

## Consecuencias
**Positivas:** demo robusta y portable; dev ágil con túnel sin desplegar en cada cambio.
**Negativas:** ~1–2 h de setup de deploy una vez.

## Riesgos y reversibilidad
- **Free tier:** límites y **cold starts** (aceptable en demo; calentar antes de presentar).
- **Pendiente externo:** confirmar con Julio que el deploy gratis no se interpreta como violar "no se requiere cloud". Si lo veta → nos quedamos en túnel (decisión reversible, sin tocar código).
