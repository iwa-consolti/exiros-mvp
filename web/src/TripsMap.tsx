import { useEffect, useMemo, useState } from 'react';
import { Circle, CircleMarker, LayerGroup, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import type { Trip } from './api';
import { deriveState, STATE_COLOR, STATE_LABEL } from './tripState';
import { DEFAULT_CENTER } from './constants';

type Base = 'mapa' | 'satelite';

/**
 * Mapa de tránsito W1 (10.2). Pinta el último punto de cada viaje activo (En ruta / Detenido)
 * coloreado por su estado derivado + la geocerca de su destino. Panel de capas
 * (Mapa / Satélite / Geocercas / Clusters). Usa CircleMarker para evitar el problema de los
 * iconos PNG de Leaflet con bundlers (Vite); los clusters usan leaflet.markercluster (vanilla,
 * sin riesgo de compat con React 19).
 */
export default function TripsMap({
  trips,
  selectedId,
  onSelect,
}: {
  trips: Trip[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const [base, setBase] = useState<Base>('mapa');
  const [showGeofences, setShowGeofences] = useState(true);
  const [showClusters, setShowClusters] = useState(false);

  // Solo viajes activos con ubicación: lo que tiene sentido pintar en un mapa "en tiempo real".
  const plotted = useMemo(
    () =>
      trips
        .filter((t) => t.status === 'EN_RUTA' && t.lastLocation)
        .map((t) => ({ trip: t, state: deriveState(t) })),
    [trips],
  );

  const center: [number, number] = plotted[0]
    ? [plotted[0].trip.lastLocation!.lat, plotted[0].trip.lastLocation!.lng]
    : DEFAULT_CENTER;

  return (
    <div className="map-canvas">
      <MapContainer center={center} zoom={6} style={{ height: '100%', width: '100%' }}>
        {base === 'mapa' ? (
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        ) : (
          <TileLayer
            attribution="&copy; Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        )}

        {showGeofences && (
          <LayerGroup>
            {plotted.map(({ trip }) =>
              trip.destination ? (
                <Circle
                  key={`geo-${trip.id}`}
                  center={[trip.destination.centerLat, trip.destination.centerLng]}
                  radius={trip.destination.radiusMeters}
                  pathOptions={{ color: '#0D479C', fillOpacity: 0.08 }}
                />
              ) : null,
            )}
          </LayerGroup>
        )}

        {showClusters ? (
          <ClusterLayer plotted={plotted} onSelect={onSelect} />
        ) : (
          plotted.map(({ trip, state }) => (
            <CircleMarker
              key={`loc-${trip.id}`}
              center={[trip.lastLocation!.lat, trip.lastLocation!.lng]}
              radius={selectedId === trip.id ? 11 : 8}
              pathOptions={{
                color: selectedId === trip.id ? '#0D479C' : STATE_COLOR[state],
                fillColor: STATE_COLOR[state],
                fillOpacity: 0.9,
                weight: selectedId === trip.id ? 4 : 2,
              }}
              eventHandlers={{ click: () => onSelect?.(trip.id) }}
            >
              <Popup>
                <strong>{trip.folio}</strong> · {trip.frontPlate}
                <br />
                {trip.providerName}
                <br />
                {trip.destination?.name ?? '—'} · {STATE_LABEL[state]}
              </Popup>
            </CircleMarker>
          ))
        )}

        <PanTo trip={plotted.find((p) => p.trip.id === selectedId)?.trip ?? null} />
      </MapContainer>

      <div className="map-controls">
        <span className="map-controls-title">Capas</span>
        <label>
          <input type="radio" name="base" checked={base === 'mapa'} onChange={() => setBase('mapa')} />
          Mapa
        </label>
        <label>
          <input
            type="radio"
            name="base"
            checked={base === 'satelite'}
            onChange={() => setBase('satelite')}
          />
          Satélite
        </label>
        <hr className="map-controls-sep" />
        <label>
          <input
            type="checkbox"
            checked={showGeofences}
            onChange={(e) => setShowGeofences(e.target.checked)}
          />
          Geocercas
        </label>
        <label>
          <input
            type="checkbox"
            checked={showClusters}
            onChange={(e) => setShowClusters(e.target.checked)}
          />
          Clusters
        </label>
      </div>
    </div>
  );
}

type Plotted = { trip: Trip; state: ReturnType<typeof deriveState> };

/** Agrupa los markers con leaflet.markercluster (imperativo): burbujas con conteo a bajo zoom. */
function ClusterLayer({
  plotted,
  onSelect,
}: {
  plotted: Plotted[];
  onSelect?: (id: string) => void;
}) {
  const map = useMap();
  useEffect(() => {
    const group = L.markerClusterGroup({ showCoverageOnHover: false });
    for (const { trip, state } of plotted) {
      const marker = L.circleMarker([trip.lastLocation!.lat, trip.lastLocation!.lng], {
        radius: 8,
        color: STATE_COLOR[state],
        fillColor: STATE_COLOR[state],
        fillOpacity: 0.9,
        weight: 2,
      });
      // DOM con textContent (no HTML interpolado): los campos vienen de la app móvil de
      // acceso libre → evita XSS almacenado en el navegador del monitorista.
      const el = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = trip.folio;
      el.append(title, ` · ${trip.frontPlate}`, document.createElement('br'));
      el.append(trip.providerName, document.createElement('br'));
      el.append(`${trip.destination?.name ?? '—'} · ${STATE_LABEL[state]}`);
      marker.bindPopup(el);
      marker.on('click', () => onSelect?.(trip.id));
      group.addLayer(marker);
    }
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
    };
  }, [map, plotted, onSelect]);
  return null;
}

/** Centra el mapa en el viaje seleccionado desde la tabla. */
function PanTo({ trip }: { trip: Trip | null }) {
  const map = useMap();
  useEffect(() => {
    if (trip?.lastLocation) {
      map.setView([trip.lastLocation.lat, trip.lastLocation.lng], Math.max(map.getZoom(), 9), {
        animate: true,
      });
    }
  }, [map, trip]);
  return null;
}
