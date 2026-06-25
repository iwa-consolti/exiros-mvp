// Cliente HTTP mínimo del portal. Base configurable por env (Vite), default dev.
export const API_BASE: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

export type TripStatus = 'EN_RUTA' | 'CONCLUIDO';
export type Role = 'ADMIN' | 'MONITOR';

/** Usuario autenticado (UserPublic del backend, sin passwordHash). */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
}

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
  destination: {
    id: string;
    name: string;
    centerLat: number;
    centerLng: number;
    radiusMeters: number;
  } | null;
  /** Último punto de ruta recibido (de los lotes de ingesta); null si aún no llega ninguno. */
  lastLocation: { lat: number; lng: number; recordedAt: string } | null;
}

export type ClosureType = 'AUTO_GEOFENCE' | 'MANUAL_OPERATOR' | 'MANUAL_ADMIN';

export interface RoutePoint {
  lat: number;
  lng: number;
  recordedAt: string;
}

/** Detalle del viaje (W3): TripSummary + ruta completa. */
export interface TripDetail {
  id: string;
  providerNumber: string;
  providerName: string;
  folio: string;
  frontPlate: string;
  rearPlate: string | null;
  status: TripStatus;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
  closureType: ClosureType | null;
  observations: string | null;
  photoPath: string;
  destination: {
    name: string;
    centerLat: number;
    centerLng: number;
    radiusMeters: number;
  } | null;
  route: RoutePoint[];
}

/** Usuario del staff (W5). */
export interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

/** Destino/geocerca (W4). */
export interface Destination {
  id: string;
  name: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  isActive: boolean;
}

export type DestinationInput = Omit<Destination, 'id' | 'isActive'>;

// --- Sesión (JWT del staff, Fase 6.1) -------------------------------------
const TOKEN_KEY = 'exiros_token';
const USER_KEY = 'exiros_user';

/** Error de API con el status HTTP, para que la UI distinga 401 (sesión) del resto. */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    // localStorage corrupto: limpiar sesión y arrancar como invitado (fail-fast controlado,
    // no pantalla blanca). Lo invoca AuthProvider en el estado inicial.
    clearSession();
    return null;
  }
}

function setSession(token: string, user: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Lanza ApiError con el mensaje del backend; en 401 limpia la sesión caduca. */
async function ensureOk(res: Response, fallback: string): Promise<void> {
  if (res.ok) return;
  if (res.status === 401) clearSession();
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  throw new ApiError(res.status, body?.message ?? fallback);
}

/** Login del staff (W0). Guarda token + usuario en localStorage. */
export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/api/web/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  await ensureOk(res, 'No se pudo iniciar sesión');
  const data = (await res.json()) as { accessToken: string; user: AuthUser };
  setSession(data.accessToken, data.user);
  return data.user;
}

export async function fetchTrips(): Promise<Trip[]> {
  const res = await fetch(`${API_BASE}/api/web/trips`, { headers: authHeaders() });
  await ensureOk(res, `GET /api/web/trips → ${res.status}`);
  return res.json() as Promise<Trip[]>;
}

/** Detalle de un viaje (W3). 404 → ApiError(404). */
export async function fetchTripDetail(id: string): Promise<TripDetail> {
  const res = await fetch(`${API_BASE}/api/web/trips/${id}`, { headers: authHeaders() });
  await ensureOk(res, `GET /api/web/trips/${id} → ${res.status}`);
  return res.json() as Promise<TripDetail>;
}

/** URL absoluta de la foto servida por el backend en /uploads. */
export function photoUrl(photoPath: string): string {
  return `${API_BASE}${photoPath}`;
}

/** Cierre forzado por admin (W3 / 4.5). 409 = el viaje ya estaba concluido (carrera). */
export async function closeTripAdmin(id: string, observations: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/web/trips/${id}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ observations }),
  });
  await ensureOk(res, `cierre → ${res.status}`);
}

// --- Usuarios (W5 / Fase 6.2) ---------------------------------------------
export interface CreateUserInput {
  name: string;
  email: string;
  role: Role;
  password: string;
}

export async function fetchUsers(): Promise<StaffUser[]> {
  const res = await fetch(`${API_BASE}/api/web/users`, { headers: authHeaders() });
  await ensureOk(res, `GET /api/web/users → ${res.status}`);
  return res.json() as Promise<StaffUser[]>;
}

export async function createUser(input: CreateUserInput): Promise<StaffUser> {
  const res = await fetch(`${API_BASE}/api/web/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  await ensureOk(res, 'No se pudo crear el usuario');
  return res.json() as Promise<StaffUser>;
}

export async function updateUser(
  id: string,
  input: { name: string; role: Role },
): Promise<StaffUser> {
  const res = await fetch(`${API_BASE}/api/web/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  await ensureOk(res, 'No se pudo actualizar el usuario');
  return res.json() as Promise<StaffUser>;
}

export async function setUserActive(id: string, active: boolean): Promise<void> {
  const action = active ? 'restore' : 'deactivate';
  const res = await fetch(`${API_BASE}/api/web/users/${id}/${action}`, {
    method: 'PATCH',
    headers: authHeaders(),
  });
  await ensureOk(res, 'No se pudo cambiar el estado del usuario');
}

// --- Destinos (W4 / Fase 5.1) ---------------------------------------------
export async function fetchDestinations(): Promise<Destination[]> {
  const res = await fetch(`${API_BASE}/api/web/destinations`, { headers: authHeaders() });
  await ensureOk(res, `GET /api/web/destinations → ${res.status}`);
  return res.json() as Promise<Destination[]>;
}

export async function createDestination(input: DestinationInput): Promise<Destination> {
  const res = await fetch(`${API_BASE}/api/web/destinations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  await ensureOk(res, 'No se pudo crear el destino');
  return res.json() as Promise<Destination>;
}

export async function updateDestination(
  id: string,
  input: DestinationInput,
): Promise<Destination> {
  const res = await fetch(`${API_BASE}/api/web/destinations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  await ensureOk(res, 'No se pudo actualizar el destino');
  return res.json() as Promise<Destination>;
}

/** Baja lógica / restauración (active=false/true). */
export async function setDestinationActive(id: string, active: boolean): Promise<void> {
  const action = active ? 'restore' : 'deactivate';
  const res = await fetch(`${API_BASE}/api/web/destinations/${id}/${action}`, {
    method: 'PATCH',
    headers: authHeaders(),
  });
  await ensureOk(res, 'No se pudo cambiar el estado del destino');
}

/** Filtros del reporte (W2 / 7.2). Vacíos = todos los viajes. */
export interface ReportFilters {
  status?: TripStatus;
  from?: string; // ISO 8601
  to?: string; // ISO 8601
  destinationId?: string;
}

/** Descarga el .xlsx del reporte aplicando filtros y dispara la descarga en el navegador. */
export async function exportReport(filters: ReportFilters): Promise<void> {
  const qs = new URLSearchParams();
  if (filters.status) qs.set('status', filters.status);
  if (filters.from) qs.set('from', filters.from);
  if (filters.to) qs.set('to', filters.to);
  if (filters.destinationId) qs.set('destinationId', filters.destinationId);
  const url = `${API_BASE}/api/web/reports/export${qs.toString() ? `?${qs}` : ''}`;

  const res = await fetch(url, { headers: authHeaders() });
  await ensureOk(res, `export → ${res.status}`);

  const blob = await res.blob();
  const cd = res.headers.get('content-disposition') ?? '';
  const match = /filename="?([^"]+)"?/.exec(cd);
  const filename = match?.[1] ?? 'reporte-viajes.xlsx';

  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}
