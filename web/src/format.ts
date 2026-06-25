/** Fecha+hora corta es-MX. `fullYear=true` muestra el año con 4 dígitos (detalle de viaje). */
export function formatDateTime(iso: string, fullYear = false): string {
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: fullYear ? 'numeric' : '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Duración en minutos → "HH:MM" (— si null). */
export function formatDuration(minutes: number | null): string {
  if (minutes === null) return '—';
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Tiempo relativo "hace X" desde un ISO hasta `now` (ms epoch). */
export function formatAgo(iso: string | undefined, now: number): string {
  if (!iso) return '—';
  const mins = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'hace un momento';
  if (mins < 60) return `${mins} min atrás`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min atrás` : `${h} h atrás`;
}
