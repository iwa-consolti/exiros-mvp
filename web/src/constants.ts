import type { Role } from './api';

/** Centro por defecto del mapa (Monterrey) cuando no hay puntos ni destino. */
export const DEFAULT_CENTER: [number, number] = [25.6866, -100.3161];

/** Etiqueta legible de cada rol (sidebar + tabla de usuarios). */
export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrador',
  MONITOR: 'Monitorista',
};
