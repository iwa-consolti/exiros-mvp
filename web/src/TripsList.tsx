import { photoUrl, type Trip } from './api';
import './TripsList.css';

// Bloque 2.4 [WEB]: lista/tarjetas de viajes. Slice de lectura del portal (W2 mínimo).
// Fuera de alcance aquí: filtros, paginación, export, forzar cierre (fase posterior).

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

export default function TripsList({ trips }: { trips: Trip[] }) {
  if (trips.length === 0) {
    return <p className="trips-state">No hay viajes registrados todavía.</p>;
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
          </div>
        </li>
      ))}
    </ul>
  );
}
