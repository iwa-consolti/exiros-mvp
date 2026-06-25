import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Map, Truck, MapPin, Users, LogOut, PanelLeft } from 'lucide-react';
import { useAuth } from './auth-context';
import { ROLE_LABEL } from './constants';
import './Layout.css';

const COLLAPSE_KEY = 'exiros_sidebar_collapsed';

/** Shell del portal (10.1): sidebar navy + header con usuario + <Outlet> de la sección.
 *  El sidebar se puede colapsar para ganar espacio; la preferencia se recuerda. */
export default function Layout() {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === '1',
  );
  const toggleSidebar = () =>
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      return next;
    });
  // Destinos y Usuarios solo para Admin (el backend también lo valida — no basta ocultar).
  const isAdmin = user?.role === 'ADMIN';
  const initials = (user?.name ?? '?')
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className={`shell${collapsed ? ' shell--collapsed' : ''}`}>
      <aside className="shell-sidebar">
        <div className="shell-top">
          <div className="shell-logo">
            {collapsed ? 'e' : <>ex<span>iros</span></>}
          </div>
          <button
            className="shell-collapse"
            onClick={toggleSidebar}
            title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            <PanelLeft size={18} />
          </button>
        </div>
        <nav className="shell-nav">
          <NavLink to="/mapa" className="shell-navitem" title="Mapa">
            <Map className="shell-navicon" size={18} />
            <span className="shell-label">Mapa</span>
          </NavLink>
          <NavLink to="/viajes" className="shell-navitem" title="Viajes">
            <Truck className="shell-navicon" size={18} />
            <span className="shell-label">Viajes</span>
          </NavLink>
          {isAdmin && (
            <NavLink to="/destinos" className="shell-navitem" title="Destinos">
              <MapPin className="shell-navicon" size={18} />
              <span className="shell-label">Destinos</span>
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/usuarios" className="shell-navitem" title="Usuarios">
              <Users className="shell-navicon" size={18} />
              <span className="shell-label">Usuarios</span>
            </NavLink>
          )}
        </nav>
        <button className="shell-logout" onClick={logout} title="Cerrar sesión">
          <LogOut size={16} />
          <span className="shell-label">Cerrar sesión</span>
        </button>
      </aside>

      <div className="shell-body">
        <header className="shell-header">
          <div className="shell-user">
            <span className="shell-avatar">{initials}</span>
            <span className="shell-userinfo">
              <strong>{user?.name}</strong>
              <small>{user ? ROLE_LABEL[user.role] : ''}</small>
            </span>
          </div>
        </header>
        <main className="shell-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
