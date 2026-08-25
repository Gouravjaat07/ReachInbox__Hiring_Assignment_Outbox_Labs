import { useState } from 'react';

export function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = () => {
    try {
      setLoading(true);
      window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/google`;
    } catch {
      setLoading(false);
      setError('Unable to start Google sign-in.');
    }
  };

  return (
    <div className="min-h-screen bg-[#ffe17c] px-4 text-black [background-image:radial-gradient(circle,rgba(0,0,0,0.12)_1.5px,transparent_1.5px)] [background-size:32px_32px]">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center py-12">
        <div className="grid w-full overflow-hidden rounded-3xl border-2 border-black bg-white shadow-[12px_12px_0_#000] lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-8 p-8 sm:p-12 lg:p-16">
            <div>
              <span className="inline-block rounded-full border-2 border-black bg-[#ffe17c] px-3 py-1 text-xs font-extrabold uppercase tracking-[0.3em] text-black">
                ReachInbox
              </span>
              <h1 className="mt-4 max-w-xl text-[clamp(2rem,4vw,3rem)] font-extrabold leading-[1.05] text-black">
                Schedule outreach with real infrastructure, not demo shortcuts.
              </h1>
              <p className="mt-4 max-w-xl text-lg font-medium text-[#272727]">
                Google OAuth, PostgreSQL, BullMQ, Redis, Ethereal SMTP, and a polished dashboard for production-style email campaigns.
              </p>
            </div>
            <div>
              <button
                onClick={handleLogin}
                disabled={loading}
                className="inline-flex cursor-pointer items-center justify-center gap-2.5 rounded-full border-2 border-black bg-black px-6 py-3.5 text-sm font-extrabold text-white shadow-[6px_6px_0_#000] transition-shadow duration-150 hover:shadow-[3px_3px_0_#000] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-[6px_6px_0_#000]"
              >
                {loading ? (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
                    <path d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.73.12-1.43.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93z" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                {loading ? 'Redirecting...' : 'Continue with Google'}
              </button>
              {error ? (
                <div className="mt-3 inline-block rounded-full border-2 border-black bg-[#ffb3b3] px-3 py-1 text-sm font-bold text-black">
                  {error}
                </div>
              ) : null}
            </div>
          </div>
          <div className="border-t-2 border-black bg-[#fff8e6] p-8 sm:p-12 lg:border-l-2 lg:border-t-0 lg:p-16">
            <div className="rounded-2xl border-2 border-black bg-white p-6 shadow-[6px_6px_0_#000]">
              <div className="inline-block rounded-full border-2 border-black bg-[#d9f7e3] px-3 py-1 text-xs font-extrabold text-black">
                Live queue orchestration
              </div>
              <div className="mt-4 text-2xl font-extrabold text-black">Delayed jobs, rate limiting, and idempotency.</div>
              <ul className="mt-6 space-y-3 text-sm font-medium text-[#272727]">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-[#ff9900]">▸</span> HTTP-only auth cookies
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-[#ff9900]">▸</span> Redis-backed distributed throttling
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-[#ff9900]">▸</span> Prisma as the source of truth
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-[#ff9900]">▸</span> Nodemailer sending through Ethereal SMTP
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}