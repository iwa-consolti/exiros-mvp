import { Circle, CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Trip } from './api';

/**
 * Mapa del portal (W1 mínimo / bala trazadora). Pinta el último punto de cada viaje
 * activo + la geocerca de su destino. Usa CircleMarker para evitar el problema de
 * los iconos PNG de Leaflet con bundlers (Vite).
 */
export default function TripsMap({ trips }: { trips: Trip[] }) {
  const withLocation = trips.filter((t) => t.lastLocation !== null);
  // Centro: último punto disponible, o Monterrey por defecto.
  const center: [number, number] = withLocation[0]?.lastLocation
    ? [withLocation[0].lastLocation.lat, withLocation[0].lastLocation.lng]
    : [25.6866, -100.3161];

  return (
    <MapContainer center={center} zoom={11} style={{ height: '360px', width: '100%' }}>
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {trips.map((t) => {
        const items = [];
        // Geocerca del destino (círculo del radio asignado).
        if (t.destination) {
          items.push(
            <Circle
              key={`geo-${t.id}`}
              center={[t.destination.centerLat, t.destination.centerLng]}
              radius={300}
              pathOptions={{ color: '#1565C0', fillOpacity: 0.08 }}
            />,
          );
        }
        // Último punto de ruta del camión.
        if (t.lastLocation) {
          items.push(
            <CircleMarker
              key={`loc-${t.id}`}
              center={[t.lastLocation.lat, t.lastLocation.lng]}
              radius={8}
              pathOptions={{ color: '#C62828', fillColor: '#C62828', fillOpacity: 0.9 }}
            >
              <Popup>
                <strong>{t.folio}</strong> · {t.frontPlate}
                <br />
                {t.providerName}
                <br />
                {t.lastLocation.lat.toFixed(4)}, {t.lastLocation.lng.toFixed(4)}
              </Popup>
            </CircleMarker>,
          );
        }
        return items;
      })}
    </MapContainer>
  );
}
