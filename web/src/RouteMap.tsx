import { Circle, CircleMarker, MapContainer, Polyline, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { TripDetail } from './api';
import { DEFAULT_CENTER } from './constants';

/** Mapa "Ruta recorrida" del detalle (W3): polilínea de la ruta + inicio/fin + geocerca. */
export default function RouteMap({ trip }: { trip: TripDetail }) {
  const pts = trip.route.map((p) => [p.lat, p.lng] as [number, number]);
  const dest = trip.destination;
  const center: [number, number] = pts[0] ??
    (dest ? [dest.centerLat, dest.centerLng] : DEFAULT_CENTER);
  const start = pts[0];
  const end = pts[pts.length - 1];

  return (
    <MapContainer center={center} zoom={7} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {dest && (
        <Circle
          center={[dest.centerLat, dest.centerLng]}
          radius={dest.radiusMeters}
          pathOptions={{ color: '#0D479C', fillOpacity: 0.08 }}
        />
      )}
      {pts.length > 1 && (
        <Polyline positions={pts} pathOptions={{ color: '#1d6fe0', weight: 4 }} />
      )}
      {start && (
        <CircleMarker
          center={start}
          radius={7}
          pathOptions={{ color: '#16A34A', fillColor: '#16A34A', fillOpacity: 0.9 }}
        >
          <Popup>Inicio</Popup>
        </CircleMarker>
      )}
      {end && pts.length > 1 && (
        <CircleMarker
          center={end}
          radius={7}
          pathOptions={{ color: '#C62828', fillColor: '#C62828', fillOpacity: 0.9 }}
        >
          <Popup>Último punto</Popup>
        </CircleMarker>
      )}
    </MapContainer>
  );
}
