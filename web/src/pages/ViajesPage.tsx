import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  ApiError,
  exportReport,
  fetchDestinations,
  fetchTripsPage,
  type Destination,
  type ReportFilters,
  type Trip,
  type TripStatus,
} from '../api';
import { useAuth } from '../auth-context';
import { formatDateTime } from '../format';
import './page.css';
import './viajes.css';

const PAGE_SIZE = 8;

const STATUS_LABEL: Record<TripStatus, string> = {
  EN_RUTA: 'En ruta',
  CONCLUIDO: 'Concluido',
};

/** W2 Viajes (10.3): historial con filtros, tabla, paginación y "Exportar a Excel".
 *  Filtros y paginación son SERVER-SIDE: el backend devuelve solo la página pedida. */
export default function ViajesPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState<'' | TripStatus>('');
  const [destino, setDestino] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const [rows, setRows] = useState<Trip[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [destinos, setDestinos] = useState<Destination[]>([]);

  // Catálogo de destinos para el filtro (independiente de la página de viajes cargada).
  useEffect(() => {
    fetchDestinations()
      .then(setDestinos)
      .catch(() => setDestinos([]));
  }, []);

  // Búsqueda con debounce: evita una petición por tecla.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(id);
  }, [search]);

  // Al cambiar cualquier filtro, vuelve a la primera página.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setPage(1), [debouncedSearch, estado, destino, from, to]);

  // Carga server-side de la página actual con los filtros aplicados.
  useEffect(() => {
    let cancelled = false;
    fetchTripsPage({
      page,
      pageSize: PAGE_SIZE,
      search: debouncedSearch || undefined,
      status: estado || undefined,
      destinationId: destino || undefined,
      from: from ? `${from}T00:00:00` : undefined,
      to: to ? `${to}T23:59:59` : undefined,
    })
      .then((res) => {
        if (cancelled) return;
        setRows(res.data);
        setTotal(res.total);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) logout();
        else setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [page, debouncedSearch, estado, destino, from, to, logout]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, totalPages);

  const hasFilters = search || estado || destino || from || to;
  const clearFilters = () => {
    setSearch('');
    setEstado('');
    setDestino('');
    setFrom('');
    setTo('');
    setPage(1);
  };

  async function onExport() {
    setExporting(true);
    try {
      const filters: ReportFilters = {};
      if (estado) filters.status = estado;
      if (from) filters.from = `${from}T00:00:00`;
      if (to) filters.to = `${to}T23:59:59`;
      if (destino) filters.destinationId = destino;
      await exportReport(filters);
    } catch {
      alert('No se pudo generar el reporte.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h1 className="page-title">Viajes</h1>
          <p className="page-sub">Historial y seguimiento de todos los viajes registrados.</p>
        </div>
        <button className="btn-export" onClick={() => void onExport()} disabled={exporting}>
          ⤓ {exporting ? 'Generando…' : 'Exportar a Excel'}
        </button>
      </div>

      <div className="viajes-filters">
        <input
          className="viajes-search"
          placeholder="Buscar folio o placa…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={estado} onChange={(e) => setEstado(e.target.value as '' | TripStatus)}>
          <option value="">Estado: Todos</option>
          <option value="EN_RUTA">En ruta</option>
          <option value="CONCLUIDO">Concluido</option>
        </select>
        <label className="viajes-date-filter" title="Filtra viajes iniciados desde esta fecha">
          <span>Inicio desde</span>
          <input
            type="date"
            aria-label="Fecha inicial de inicio del viaje"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="viajes-date-filter" title="Filtra viajes iniciados hasta esta fecha">
          <span>Inicio hasta</span>
          <input
            type="date"
            aria-label="Fecha final de inicio del viaje"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <select value={destino} onChange={(e) => setDestino(e.target.value)}>
          <option value="">Destino: Todos</option>
          {destinos.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button className="viajes-clear" onClick={clearFilters}>
            Limpiar filtros
          </button>
        )}
      </div>

      {error && <p className="page-error">No se pudieron cargar los viajes: {error}</p>}
      {rows === null && !error && <p className="page-state">Cargando viajes…</p>}

      {rows !== null && (
        <>
          <div className="viajes-table-wrap">
            <table className="viajes-table">
              <thead>
                <tr>
                  <th>FOLIO</th>
                  <th>PROVEEDOR</th>
                  <th>DESTINO</th>
                  <th>PLACA</th>
                  <th>ESTADO</th>
                  <th>INICIO</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} onClick={() => navigate(`/viajes/${t.id}`)}>
                    <td className="viajes-folio">{t.folio}</td>
                    <td>{t.providerName}</td>
                    <td>{t.destination?.name ?? '—'}</td>
                    <td>{t.frontPlate}</td>
                    <td>
                      <span className={`badge badge--${t.status.toLowerCase()}`}>
                        {STATUS_LABEL[t.status]}
                      </span>
                    </td>
                    <td>{formatDateTime(t.startedAt)}</td>
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
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="viajes-empty">
                      No hay viajes que coincidan con los filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="viajes-foot">
            <span>
              Mostrando {total === 0 ? 0 : (current - 1) * PAGE_SIZE + 1} a{' '}
              {Math.min(current * PAGE_SIZE, total)} de {total} viajes
            </span>
            {totalPages > 1 && (
              <div className="viajes-pages">
                <button disabled={current === 1} onClick={() => setPage(current - 1)}>
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    className={p === current ? 'is-active' : ''}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                ))}
                <button disabled={current === totalPages} onClick={() => setPage(current + 1)}>
                  ›
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
