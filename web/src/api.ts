// Cliente HTTP mínimo del portal. Base configurable por env (Vite), default dev.
export const API_BASE: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

export type TripStatus = 'EN_RUTA' | 'CONCLUIDO';

/** Viaje tal como lo devuelve GET /api/web/trips (subconjunto de campos del backend). */
export interface Trip {
  id: string;
  providerNumber: string;
  providerName: string;
  folio: string;
  frontPlate: string;
  rearPlate: string;
  status: TripStatus;
  startedAt: string;
  endedAt: string | null;
  photoPath: string;
  destination: { name: string; centerLat: number; centerLng: number } | null;
  /** Último punto de ruta (bala trazadora / Slice 0); null si aún no llega ninguno. */
  lastLocation: { lat: number; lng: number; recordedAt: string } | null;
}

export async function fetchTrips(): Promise<Trip[]> {
  const res = await fetch(`${API_BASE}/api/web/trips`);
  if (!res.ok) {
    throw new Error(`GET /api/web/trips → ${res.status}`);
  }
  return res.json() as Promise<Trip[]>;
}

/** URL absoluta de la foto servida por el backend en /uploads. */
export function photoUrl(photoPath: string): string {
  return `${API_BASE}${photoPath}`;
}
