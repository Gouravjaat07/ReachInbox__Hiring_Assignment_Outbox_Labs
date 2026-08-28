import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';

export function OAuthComplete() {
  const location = useLocation();
  const navigate = useNavigate();
  const started = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const handoff = new URLSearchParams(location.search).get('handoff');
    // Remove the short-lived, one-time handoff code before sending the request.
    window.history.replaceState(window.history.state, '', '/auth/complete');

    if (!handoff) {
      authApi.me()
        .then(() => navigate('/dashboard', { replace: true }))
        .catch(() => setFailed(true));
      return;
    }

    authApi.completeHandoff(handoff)
      .then(() => navigate('/dashboard', { replace: true }))
      .catch(() => setFailed(true));
  }, [location.search, navigate]);

  if (failed) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-4 text-center text-white">
        <p>Sign-in could not be completed. Please try again.</p>
        <button className="rounded bg-white px-4 py-2 font-semibold text-slate-950" onClick={() => navigate('/login', { replace: true })}>
          Return to login
        </button>
      </main>
    );
  }

  return <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">Completing sign-in…</main>;
}
