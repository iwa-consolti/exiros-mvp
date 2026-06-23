import { closeTripAdmin, photoUrl, type Trip } from './api';
import './TripsList.css';

// Bloque 2.4 [WEB]: lista/tarjetas de viajes (W2 mínimo) + forzar cierre admin (4.5 / W3).
// Fuera de alcance aquí: filtros, paginación, export, página de detalle completa.

const STATUS_LABEL: Record<Trip['status'], string> = {
  EN_RUTA: 'En ruta',
  CONCLUIDO: 'Concluido',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export default function TripsList({
  trips,
  onClosed,
}: {
  trips: Trip[];
  onClosed?: () => void;
}) {
  if (trips.length === 0) {
    return <p className="trips-state">No hay viajes registrados todavía.</p>;
  }

  // Forzar cierre admin: pide observación (obligatoria) y refresca al terminar.
  async function forceClose(id: string) {
    const observations = window.prompt('Observación del cierre (obligatoria):')?.trim();
    if (!observations) return;
    try {
      await closeTripAdmin(id, observations);
      onClosed?.();
    } catch (e) {
      window.alert(`No se pudo cerrar: ${String(e)}`);
    }
  }

  return (
    <ul className="trips-grid">
      {trips.map((t) => (
        <li key={t.id} className="trip-card">
          <img
            className="trip-card__photo"
            src={photoUrl(t.photoPath)}
            alt={`Camión folio ${t.folio}`}
          />
          <div className="trip-card__body">
            <div className="trip-card__head">
              <span className="trip-card__provider">{t.providerName}</span>
              <span
                className={`trip-badge trip-badge--${t.status === 'EN_RUTA' ? 'active' : 'done'}`}
              >
                {STATUS_LABEL[t.status]}
              </span>
            </div>
            <dl className="trip-card__meta">
              <div>
                <dt>Folio</dt>
                <dd>{t.folio}</dd>
              </div>
              <div>
                <dt>Placa frontal</dt>
                <dd>{t.frontPlate}</dd>
              </div>
              <div>
                <dt>Destino</dt>
                <dd>{t.destination?.name ?? '—'}</dd>
              </div>
              <div>
                <dt>Inicio</dt>
                <dd>{formatDate(t.startedAt)}</dd>
              </div>
            </dl>
            {t.status === 'EN_RUTA' && (
              <button className="trip-card__close" onClick={() => void forceClose(t.id)}>
                Forzar cierre
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
