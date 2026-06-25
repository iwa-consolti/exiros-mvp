import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth-context';
import Layout from './Layout';
import Login from './Login';
import MapaPage from './pages/MapaPage';
import ViajesPage from './pages/ViajesPage';
import ViajeDetallePage from './pages/ViajeDetallePage';
import DestinosPage from './pages/DestinosPage';
import UsuariosPage from './pages/UsuariosPage';

/** Rutas solo-ADMIN: un MONITOR que las teclea por URL se redirige al mapa (el backend ya
 *  las protege con AdminRolesGuard; esto evita montar una página que falla en cada llamada). */
function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'ADMIN') return <Navigate to="/mapa" replace />;
  return children;
}

/** Sin sesión → Login; con sesión → shell con sus rutas (10.1). */
function Routed() {
  const { user, setUser } = useAuth();
  if (!user) return <Login onLogin={setUser} />;

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/mapa" element={<MapaPage />} />
          <Route path="/viajes" element={<ViajesPage />} />
          <Route path="/viajes/:id" element={<ViajeDetallePage />} />
          <Route
            path="/destinos"
            element={
              <RequireAdmin>
                <DestinosPage />
              </RequireAdmin>
            }
          />
          <Route
            path="/usuarios"
            element={
              <RequireAdmin>
                <UsuariosPage />
              </RequireAdmin>
            }
          />
          <Route path="*" element={<Navigate to="/mapa" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routed />
    </AuthProvider>
  );
}
