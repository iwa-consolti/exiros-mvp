import { useState } from 'react';
import {
  Circle,
  CircleMarker,
  MapContainer,
  TileLayer,
  useMapEvents,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { X } from 'lucide-react';
import {
  createDestination,
  updateDestination,
  type Destination,
  type DestinationInput,
} from '../api';
import { DEFAULT_CENTER } from '../constants';
import './destinos.css';

const RADIUS_MIN = 100;
const RADIUS_MAX = 700;

/** Captura el clic en el mapa para reubicar el centro de la geocerca. */
function ClickToSet({ onSet }: { onSet: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onSet(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Modal "Nuevo/Editar destino" (W4): nombre + mapa para fijar centro + radio. */
export default function DestinoModal({
  destino,
  onClose,
  onSaved,
}: {
  destino: Destination | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(destino?.name ?? '');
  const [lat, setLat] = useState(destino?.centerLat ?? DEFAULT_CENTER[0]);
  const [lng, setLng] = useState(destino?.centerLng ?? DEFAULT_CENTER[1]);
  const [radius, setRadius] = useState(destino?.radiusMeters ?? 100);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    if (!name.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    if (radius < RADIUS_MIN || radius > RADIUS_MAX) {
      setError(`El radio debe estar entre ${RADIUS_MIN} y ${RADIUS_MAX} m.`);
      return;
    }
    setSaving(true);
    setError(null);
    const input: DestinationInput = {
      name: name.trim(),
      centerLat: lat,
      centerLng: lng,
      radiusMeters: Math.round(radius),
    };
    try {
      if (destino) await updateDestination(destino.id, input);
      else await createDestination(input);
      onSaved();
    } catch {
      setError('No se pudo guardar el destino.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{destino ? 'Editar destino' : 'Nuevo destino'}</h2>
          <button className="modal-x" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <label className="modal-label">Nombre</label>
        <input
          className="modal-input"
          placeholder="Ej. Planta Monterrey"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label className="modal-label">Centro en el mapa</label>
        <p className="modal-hint">Haz clic en el mapa para fijar el centro.</p>
        <div className="modal-map">
          <MapContainer
            center={[lat, lng]}
            zoom={12}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution="&copy; OpenStreetMap"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickToSet
              onSet={(la, ln) => {
                setLat(la);
                setLng(ln);
              }}
            />
            <Circle
              center={[lat, lng]}
              radius={radius}
              pathOptions={{ color: '#0D479C', fillOpacity: 0.12 }}
            />
            <CircleMarker
              center={[lat, lng]}
              radius={6}
              pathOptions={{ color: '#0D479C', fillColor: '#0D479C', fillOpacity: 1 }}
            />
          </MapContainer>
        </div>

        <label className="modal-label">Coordenadas del centro</label>
        <input
          className="modal-input modal-input--mono"
          readOnly
          value={`${lat.toFixed(5)}, ${lng.toFixed(5)}`}
        />

        <label className="modal-label">Radio de la geocerca (metros)</label>
        <input
          className="modal-input"
          type="number"
          min={RADIUS_MIN}
          max={RADIUS_MAX}
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
        />
        <p className="modal-hint">Mínimo {RADIUS_MIN} m, máximo {RADIUS_MAX} m. Número entero.</p>

        {error && <p className="modal-error">{error}</p>}

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={() => void onSave()} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar destino'}
          </button>
        </div>
      </div>
    </div>
  );
}
