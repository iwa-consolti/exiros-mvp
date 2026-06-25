import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2, RotateCcw } from 'lucide-react';
import {
  fetchUsers,
  setUserActive,
  ApiError,
  type Role,
  type StaffUser,
} from '../api';
import { useAuth } from '../auth-context';
import { ROLE_LABEL } from '../constants';
import UsuarioPanel from './UsuarioPanel';
import './page.css';
import './destinos.css';
import './usuarios.css';

const ROLE_CLASS: Record<Role, string> = {
  ADMIN: 'role--admin',
  MONITOR: 'role--monitor',
};

/** W5 Gestión de usuarios (10.6): tabla + alta/edición (panel) + baja (confirm). */
export default function UsuariosPage() {
  const { logout } = useAuth();
  const [users, setUsers] = useState<StaffUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'' | Role>('');
  const [panel, setPanel] = useState<{ open: boolean; editing: StaffUser | null }>({
    open: false,
    editing: null,
  });
  const [confirmBaja, setConfirmBaja] = useState<StaffUser | null>(null);

  const load = useCallback(async () => {
    try {
      setUsers(await fetchUsers());
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) logout();
      else setError(String(e));
    }
  }, [logout]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const all = users ?? [];
    return all.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!`${u.name} ${u.email}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [users, search, roleFilter]);

  async function doBaja() {
    if (!confirmBaja) return;
    try {
      await setUserActive(confirmBaja.id, false);
      setConfirmBaja(null);
      await load();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'No se pudo dar de baja.');
    }
  }

  return (
    <section>
      <div className="page-head">
        <div>
          <h1 className="page-title">Gestión de usuarios</h1>
          <p className="page-sub">Administra los usuarios que tienen acceso al sistema.</p>
        </div>
        <button className="btn-primary" onClick={() => setPanel({ open: true, editing: null })}>
          + Nuevo usuario
        </button>
      </div>

      <div className="viajes-filters">
        <input
          className="viajes-search"
          placeholder="Buscar por nombre o correo…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as '' | Role)}>
          <option value="">Todos los roles</option>
          <option value="ADMIN">Administrador</option>
          <option value="MONITOR">Monitorista</option>
        </select>
      </div>

      {error && <p className="page-error">{error}</p>}
      {users === null && !error && <p className="page-state">Cargando usuarios…</p>}

      {users && (
        <div className="viajes-table-wrap">
          <table className="viajes-table">
            <thead>
              <tr>
                <th>NOMBRE</th>
                <th>CORREO ELECTRÓNICO</th>
                <th>ROL</th>
                <th>ESTADO</th>
                <th>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className={u.isActive ? '' : 'row-inactive'}>
                  <td className="viajes-folio">{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`badge role ${ROLE_CLASS[u.role]}`}>
                      {ROLE_LABEL[u.role]}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${u.isActive ? 'badge--en_ruta' : 'badge--baja'}`}>
                      {u.isActive ? 'Activo' : 'Baja'}
                    </span>
                  </td>
                  <td className="dest-actions">
                    <button title="Editar" onClick={() => setPanel({ open: true, editing: u })}>
                      <Pencil size={16} />
                    </button>
                    {u.isActive ? (
                      <button title="Dar de baja" onClick={() => setConfirmBaja(u)}>
                        <Trash2 size={16} />
                      </button>
                    ) : (
                      <button
                        title="Restaurar"
                        onClick={async () => {
                          await setUserActive(u.id, true);
                          load();
                        }}
                      >
                        <RotateCcw size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="viajes-empty">
                    No hay usuarios que coincidan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {users && <p className="viajes-foot">Mostrando {filtered.length} usuarios</p>}

      {panel.open && (
        <UsuarioPanel
          user={panel.editing}
          onClose={() => setPanel({ open: false, editing: null })}
          onSaved={() => {
            setPanel({ open: false, editing: null });
            void load();
          }}
        />
      )}

      {confirmBaja && (
        <div className="modal-overlay" onClick={() => setConfirmBaja(null)}>
          <div className="confirm" onClick={(e) => e.stopPropagation()}>
            <h3>Dar de baja usuario</h3>
            <p>
              ¿Estás seguro de eliminar a <strong>{confirmBaja.name}</strong>? Perderá el acceso
              al sistema de inmediato.
            </p>
            <div className="panel-actions">
              <button className="btn-ghost" onClick={() => setConfirmBaja(null)}>
                Cancelar
              </button>
              <button className="btn-danger" onClick={() => void doBaja()}>
                <Trash2 size={15} /> Sí, dar de baja
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
