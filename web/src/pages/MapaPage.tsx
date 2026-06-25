import { useMemo, useState } from 'react';
import { Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import TripsMap from '../TripsMap';
import { useTrips } from '../useTrips';
import type { Trip } from '../api';
import { deriveState, MAP_STATES, STATE_COLOR, STATE_LABEL, type MapState } from '../tripState';
import { formatAgo } from '../format';
import './page.css';
import './mapa.css';
import './viajes.css';

/** W1 Mapa "Monitoreo en tiempo real" (10.2). KPIs En ruta/Detenido/Concluido (estado derivado),
 *  filtros + capas, leyenda de colores y tabla de viajes visibles en el mapa. */
export default function MapaPage() {
  const { trips, error, updatedAt, refreshing, reload } = useTrips();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState<'' | MapState>('');
  const [destino, setDestino] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const all = useMemo(() => trips ?? [], [trips]);

  // Estado derivado por viaje (En ruta / Detenido / Concluido), relativo al momento de la carga.
  const now = updatedAt ? updatedAt.getTime() : 0;
  const states = useMemo(
    () => new Map(all.map((t) => [t.id, deriveState(t, now)])),
    [all, now],
  );

  const counts = useMemo(() => {
    const c = { EN_RUTA: 0, DETENIDO: 0, CONCLUIDO: 0 } as Record<MapState, number>;
    for (const t of all) c[states.get(t.id)!]++;
    return c;
  }, [all, states]);

  const destinos = useMemo(
    () => [...new Set(all.map((t) => t.destination?.name).filter(Boolean))] as string[],
    [all],
  );
  const proveedores = useMemo(() => [...new Set(all.map((t) => t.providerName))], [all]);

  const filtered = all.filter((t) =>
    matches(t, states.get(t.id)!, { search, estado, destino, proveedor }),
  );
  // "Viajes visibles en el mapa" = activos con ubicación (lo que TripsMap realmente pinta).
  const visible = filtered.filter((t) => states.get(t.id) !== 'CONCLUIDO' && t.lastLocation);
  const visibleTotal = all.filter(
    (t) => states.get(t.id) !== 'CONCLUIDO' && t.lastLocation,
  ).length;

  const hasFilters = search || estado || destino || proveedor;
  const clearFilters = () => {
    setSearch('');
    setEstado('');
    setDestino('');
    setProveedor('');
  };
  const toggleEstado = (s: MapState) => setEstado(estado === s ? '' : s);

  return (
    <section>
      <div className="page-head">
        <div>
          <h1 className="page-title">Monitoreo en tiempo real</h1>
          <p className="page-sub">Ubicación de los viajes en curso. Los reportes son en vivo.</p>
        </div>
        <div className="page-actions">
          {updatedAt && (
            <span className="page-updated">Actualizado {updatedAt.toLocaleTimeString()}</span>
          )}
          <button className="btn-secondary" onClick={reload} disabled={refreshing}>
            {refreshing ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </div>

      <div className="kpi-row">
        {MAP_STATES.map((s) => (
          <button
            key={s}
            className={`kpi kpi--${s.toLowerCase()} ${estado === s ? 'kpi--on' : ''}`}
            style={{ borderLeftColor: STATE_COLOR[s] }}
            onClick={() => toggleEstado(s)}
          >
            <span className="kpi-num">{counts[s]}</span>
            <span className="kpi-label">{STATE_LABEL[s]}</span>
          </button>
        ))}
      </div>

      <div className="map-filters">
        <input
          className="map-search"
          placeholder="Buscar placa, folio o proveedor"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={estado} onChange={(e) => setEstado(e.target.value as '' | MapState)}>
          <option value="">Todos los estados</option>
          <option value="EN_RUTA">En ruta</option>
          <option value="DETENIDO">Detenido</option>
          <option value="CONCLUIDO">Concluido</option>
        </select>
        <select value={destino} onChange={(e) => setDestino(e.target.value)}>
          <option value="">Todos los destinos</option>
          {destinos.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select value={proveedor} onChange={(e) => setProveedor(e.target.value)}>
          <option value="">Todos los proveedores</option>
          {proveedores.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button className="map-clear" onClick={clearFilters}>
            Limpiar filtros
          </button>
        )}
      </div>

      {error && <p className="page-error">No se pudieron cargar los viajes: {error}</p>}
      {trips === null && !error && <p className="page-state">Cargando viajes…</p>}
      {trips !== null && (
        <>
          <div className="map-wrap">
            <TripsMap trips={filtered} selectedId={selectedId} onSelect={setSelectedId} />
            <div className="map-legend">
              <span className="map-legend-title">Estado del viaje</span>
              {MAP_STATES.map((s) => (
                <span key={s} className="map-legend-row">
                  <i style={{ background: STATE_COLOR[s] }} /> {STATE_LABEL[s]}
                </span>
              ))}
            </div>
          </div>

          <div className="map-list-head">
            <h2 className="map-list-title">Viajes visibles en el mapa</h2>
            <span className="map-list-count">
              Mostrando {visible.length} de {visibleTotal} viajes en el área
            </span>
          </div>
          <div className="viajes-table-wrap">
            <table className="viajes-table">
              <thead>
                <tr>
                  <th>PLACA</th>
                  <th>FOLIO</th>
                  <th>PROVEEDOR</th>
                  <th>DESTINO</th>
                  <th>ESTADO</th>
                  <th>ÚLT. ACTUALIZACIÓN</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => {
                  const s = states.get(t.id)!;
                  return (
                    <tr
                      key={t.id}
                      className={selectedId === t.id ? 'is-selected' : ''}
                      onClick={() => setSelectedId(t.id)}
                    >
                      <td className="viajes-folio">{t.frontPlate}</td>
                      <td>{t.folio}</td>
                      <td>{t.providerName}</td>
                      <td>{t.destination?.name ?? '—'}</td>
                      <td>
                        <span className={`badge badge--${s.toLowerCase()}`}>{STATE_LABEL[s]}</span>
                      </td>
                      <td>{formatAgo(t.lastLocation?.recordedAt, now)}</td>
                      <td>
                        <button
                          className="viajes-eye"
                          title="Ver detalle"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/viajes/${t.id}`);
                          }}
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={7} className="viajes-empty">
                      No hay viajes en el mapa con los filtros actuales.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function matches(
  t: Trip,
  state: MapState,
  f: { search: string; estado: '' | MapState; destino: string; proveedor: string },
): boolean {
  if (f.estado && state !== f.estado) return false;
  if (f.destino && t.destination?.name !== f.destino) return false;
  if (f.proveedor && t.providerName !== f.proveedor) return false;
  if (f.search) {
    const q = f.search.toLowerCase();
    const hay = `${t.frontPlate} ${t.folio} ${t.providerName}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

/** "hace X min/h" a partir del timestamp de la última lectura GPS, relativo a la carga. */
