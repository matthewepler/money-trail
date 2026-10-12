import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from '../hooks/useSession.js';

export function RequireSession() {
  const { status } = useSession();
  return status === 'signedOut' ? <Navigate to="/login" replace /> : <Outlet />;
}
