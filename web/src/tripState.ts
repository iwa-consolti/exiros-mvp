import type { Trip } from './api';

/**
 * Estado de monitoreo que se muestra en el portal. El backend solo persiste EN_RUTA/CONCLUIDO
 * (alcance MVP §6); "Detenido" es un estado DERIVADO en el portal, no un estatus en BD.
 */
export type MapState = 'EN_RUTA' | 'DETENIDO' | 'CONCLUIDO';

/** Detenido: viaje EN_RUTA sin lecturas GPS nuevas por más de 3 min (ajuste demo 2026-06-26).
 *  Funciona porque la app hiberna el GPS al detectar el camión quieto (acelerómetro) → deja de
 *  reportar; 3 min permite demostrar el estado sin esperar el ciclo real de 15–20 min. */
const STOPPED_MS = 3 * 60 * 1000;

export function deriveState(t: Trip, now: number = Date.now()): MapState {
  if (t.status === 'CONCLUIDO') return 'CONCLUIDO';
  if (t.lastLocation && now - new Date(t.lastLocation.recordedAt).getTime() > STOPPED_MS) {
    return 'DETENIDO';
  }
  return 'EN_RUTA';
}

/** Orden canónico de los estados (KPIs, leyenda, selector). Fuente única para no repetirlo. */
export const MAP_STATES: MapState[] = ['EN_RUTA', 'DETENIDO', 'CONCLUIDO'];

export const STATE_LABEL: Record<MapState, string> = {
  EN_RUTA: 'En ruta',
  DETENIDO: 'Detenido',
  CONCLUIDO: 'Concluido',
};

export const STATE_COLOR: Record<MapState, string> = {
  EN_RUTA: '#16A34A',
  DETENIDO: '#F59E0B',
  CONCLUIDO: '#64748B',
};
