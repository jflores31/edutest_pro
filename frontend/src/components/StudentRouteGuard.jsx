import { Navigate, useLocation } from 'react-router-dom';

export function StudentRouteGuard({ children }) {
  const location = useLocation();
  const attemptToken = localStorage.getItem('attempt_token');

  if (!attemptToken || attemptToken.startsWith('mock-')) {
    localStorage.removeItem('attempt_token');
    localStorage.removeItem('attempt_id');
    localStorage.removeItem('attempt_ends_at');
    localStorage.removeItem('attempt_snapshot');
    localStorage.removeItem('attempt_block_tab');
    const slug = location.pathname.split('/')[2];
    return <Navigate to={`/exam/${slug}`} replace state={{ from: location.pathname }} />;
  }

  return children;
}

export function ResultsGuard({ children }) {
  const location = useLocation();
  const result = location.state?.result;

  if (!result) {
    const slug = location.pathname.split('/')[2];
    return <Navigate to={`/exam/${slug}`} replace />;
  }

  return children;
}