import { useEffect, useState } from 'react';
import { fetchTrips, type Trip } from './api';
import TripsList from './TripsList';
import TripsMap from './TripsMap';
import './App.css';

// Bloque 2.4 [WEB]: portal con lista de viajes.
// Bloque 1.5 [WEB]: mapa (W1 mínimo) con el último punto de cada viaje (bala trazadora).
// El fetch vive aquí y se comparte con mapa + lista (DRY).
function App() {
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTrips()
      .then((data) => !cancelled && setTrips(data))
      .catch((e: unknown) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="portal-shell">
      <header className="portal-header">
        <h1>Exiros · Viajes</h1>
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
