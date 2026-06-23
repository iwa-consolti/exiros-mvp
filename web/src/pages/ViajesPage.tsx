import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { exportReport, type ReportFilters, type Trip, type TripStatus } from '../api';
import { useTrips } from '../useTrips';
import './page.css';
import './viajes.css';

const PAGE_SIZE = 8;

const STATUS_LABEL: Record<TripStatus, string> = {
  EN_RUTA: 'En ruta',
  CONCLUIDO: 'Concluido',
};

/** W2 Viajes (10.3): historial con filtros, tabla, paginación y "Exportar a Excel". */
export default function ViajesPage() {
  const { trips, error } = useTrips();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState<'' | TripStatus>('');
  const [destino, setDestino] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const all = useMemo(() => trips ?? [], [trips]);
  const destinos = useMemo(
    () => [...new Set(all.map((t) => t.destination?.name).filter(Boolean))] as string[],
    [all],
  );

  const filtered = useMemo(
    () => all.filter((t) => matches(t, { search, estado, destino, from, to })),
    [all, search, estado, destino, from, to],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const slice = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  async function onExport() {
    setExporting(true);
    try {
      const filters: ReportFilters = {};
      if (estado) filters.status = estado;
      if (from) filters.from = `${from}T00:00:00`;
      if (to) filters.to = `${to}T23:59:59`;
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
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          value={estado}
          onChange={(e) => {
            setEstado(e.target.value as '' | TripStatus);
            setPage(1);
          }}
        >
          <option value="">Estado: Todos</option>
          <option value="EN_RUTA">En ruta</option>
          <option value="CONCLUIDO">Concluido</option>
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <select
          value={destino}
          onChange={(e) => {
            setDestino(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Destino: Todos</option>
          {destinos.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="page-error">No se pudieron cargar los viajes: {error}</p>}
      {trips === null && !error && <p className="page-state">Cargando viajes…</p>}

      {trips !== null && (
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
                {slice.map((t) => (
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
                    <td>{formatDate(t.startedAt)}</td>
                    <td>
                      <button
                        className="viajes-eye"
                        title="Ver detalle"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/viajes/${t.id}`);
                        }}
                      >
                        👁
                      </button>
                    </td>
                  </tr>
                ))}
                {slice.length === 0 && (
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
              Mostrando {filtered.length === 0 ? 0 : (current - 1) * PAGE_SIZE + 1} a{' '}
              {Math.min(current * PAGE_SIZE, filtered.length)} de {filtered.length} viajes
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

function matches(
  t: Trip,
  f: { search: string; estado: '' | TripStatus; destino: string; from: string; to: string },
): boolean {
  if (f.estado && t.status !== f.estado) return false;
  if (f.destino && t.destination?.name !== f.destino) return false;
  if (f.from && t.startedAt < `${f.from}T00:00:00`) return false;
  if (f.to && t.startedAt > `${f.to}T23:59:59`) return false;
  if (f.search) {
    const q = f.search.toLowerCase();
    if (!`${t.folio} ${t.frontPlate}`.toLowerCase().includes(q)) return false;
  }
  return true;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
