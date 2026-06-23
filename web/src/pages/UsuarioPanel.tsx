import { useState } from 'react';
import { createUser, updateUser, type Role, type StaffUser } from '../api';
import './usuarios.css';

const ROLES: { value: Role; label: string }[] = [
  { value: 'SUPER_ADMIN', label: 'Super administrador' },
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'MONITOR', label: 'Monitorista' },
];

/** Panel lateral "Nuevo/Editar usuario" (W5). En edición no se cambia la contraseña. */
export default function UsuarioPanel({
  user,
  onClose,
  onSaved,
}: {
  user: StaffUser | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = user !== null;
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [role, setRole] = useState<Role | ''>(user?.role ?? '');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    if (!name.trim() || !role || (!editing && (!email.trim() || password.length < 8))) {
      setError('Completa los campos (contraseña mínimo 8 caracteres).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing) await updateUser(user.id, { name: name.trim(), role });
      else await createUser({ name: name.trim(), email: email.trim(), role, password });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el usuario.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel-overlay" onClick={onClose}>
      <aside className="panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{editing ? 'Editar usuario' : 'Nuevo usuario'}</h2>
          <button className="modal-x" onClick={onClose}>
            ✕
          </button>
        </div>

        <label className="modal-label">Nombre completo</label>
        <input
          className="modal-input"
          placeholder="Ej. Juan Pérez"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label className="modal-label">Correo electrónico</label>
        <input
          className="modal-input"
          type="email"
          placeholder="ejemplo@exiros.com"
          value={email}
          disabled={editing}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className="modal-label">Rol</label>
        <select
          className="modal-input"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
        >
          <option value="">Selecciona un rol</option>
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>

        {!editing && (
          <>
            <label className="modal-label">Contraseña inicial</label>
            <div className="panel-pass">
              <input
                className="modal-input"
                type={showPass ? 'text' : 'password'}
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" className="panel-eye" onClick={() => setShowPass((s) => !s)}>
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
          </>
        )}

        {error && <p className="modal-error">{error}</p>}

        <div className="panel-actions">
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={() => void onSave()} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar usuario'}
          </button>
        </div>
      </aside>
    </div>
  );
}
