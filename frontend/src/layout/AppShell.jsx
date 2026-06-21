import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import { Skeleton } from '../design-system';

export default function AppShell() {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <div className="space-y-4 text-center">
          <Skeleton width="48px" height="48px" variant="circle" className="mx-auto" />
          <Skeleton width="120px" height="14px" className="mx-auto" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user && user.role === 'STUDENT') {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen bg-bg text-fg-1">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}