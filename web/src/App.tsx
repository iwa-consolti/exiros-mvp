import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchTrips, type Trip } from './api';
import TripsList from './TripsList';
import TripsMap from './TripsMap';
import './App.css';

// Intervalo de refresco (polling) configurable por env; por defecto 20 min (rango 15–20 del doc).
const POLL_MS = Number(import.meta.env.VITE_POLL_MS) || 20 * 60 * 1000;

// W1 — Mapa de tránsito (3.5): el portal re-consulta los viajes cada POLL_MS y el mapa
// mueve el camión a su último punto. El fetch vive aquí y se comparte con mapa + lista (DRY).
function App() {
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return; // evita solapar peticiones
    inFlight.current = true;
    setRefreshing(true);
    try {
      const data = await fetchTrips();
      setTrips(data);
      setUpdatedAt(new Date());
      setError(null);
    } catch (e: unknown) {
      setError(String(e)); // un fallo de polling no borra el mapa ya pintado
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Fetch inicial + polling. El setState ocurre dentro de load() (async, tras el fetch);
    // la regla set-state-in-effect no aplica a una carga de datos al montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const id = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const minutes = Math.round(POLL_MS / 60000);

  return (
    <div className="portal-shell">
      <header className="portal-header">
        <h1>Exiros · Viajes</h1>
        <div className="portal-status">
          {updatedAt && (
            <span className="portal-updated">
              Actualizado {updatedAt.toLocaleTimeString()} · cada {minutes} min
            </span>
          )}
          <button className="portal-refresh" onClick={() => void load()} disabled={refreshing}>
            {refreshing ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </header>
      <main className="portal-main">
        {error && (
          <p className="trips-state trips-state--error">
            No se pudieron cargar los viajes: {error}
          </p>
        )}
        {trips === null && !error && <p className="trips-state">Cargando viajes…</p>}
        {trips !== null && (
          <>
            <TripsMap trips={trips} />
            <TripsList trips={trips} />
          </>
        )}
      </main>
    </div>
  );
}

export default App;
