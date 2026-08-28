import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ScheduledEmails } from './pages/ScheduledEmails';
import { SentEmails } from './pages/SentEmails';
import { FailedEmails } from './pages/FailedEmails';
import { ComposeEmail } from './pages/ComposeEmail';
import { OAuthComplete } from './pages/OAuthComplete';

function ProtectedRoutes() {
  const { user, loading, error, logout, refreshAuth } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">Loading ReachInbox...</div>;
  }

  if (!user) {
    if (error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-4 text-center text-white">
          <p>{error}</p>
          <button className="rounded bg-white px-4 py-2 font-semibold text-slate-950" onClick={refreshAuth}>
            Retry
          </button>
        </div>
      );
    }

    return <Navigate to="/login" replace />;
  }

  return (
    <DashboardLayout user={user} onLogout={logout}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard user={user} />} />
        <Route path="/dashboard/compose" element={<ComposeEmail />} />
        <Route path="/dashboard/scheduled" element={<ScheduledEmails />} />
        <Route path="/dashboard/sent" element={<SentEmails />} />
        <Route path="/dashboard/failed" element={<FailedEmails />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </DashboardLayout>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/complete" element={<OAuthComplete />} />
        <Route path="/*" element={<ProtectedRoutes />} />
      </Routes>
    </BrowserRouter>
  );
}
