import { useEffect, useState } from 'react';
import { emailApi } from '../services/api';
import type { Email } from '../types';

export function SentEmails() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setEmails(await emailApi.sent());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sent emails');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, []);

  return (
    <div className="rounded-3xl border-2 border-black bg-white p-6 shadow-[8px_8px_0_#000]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-black">Sent Emails</h1>
          <p className="mt-2 text-sm font-medium text-[#272727]">Deliveries confirmed by the worker</p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="flex cursor-pointer items-center gap-2 rounded-full border-2 border-black bg-white px-4 py-2.5 text-sm font-extrabold text-black shadow-[4px_4px_0_#000] transition hover:translate-x-1 hover:translate-y-1 hover:shadow-[2px_2px_0_#000] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0_#000]"
        >
          <svg
            className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border-2 border-black bg-[#ffb3b3] px-4 py-3 text-sm font-bold text-black shadow-[4px_4px_0_#000]">
          <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-xl border-2 border-black/10 bg-[#f5f5f5]"
            />
          ))}
        </div>
      ) : null}

      {!loading && emails.length === 0 ? (
        <div className="mt-6 rounded-2xl border-2 border-dashed border-black p-8 text-center text-sm font-bold text-[#272727]">
          No sent emails yet.
        </div>
      ) : null}

      {!loading && emails.length > 0 ? (
        <div className="mt-6 overflow-hidden rounded-2xl border-2 border-black shadow-[6px_6px_0_#000]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y-2 divide-black text-sm">
              <thead className="bg-[#ffe17c] text-left text-black">
                <tr>
                  <th className="px-4 py-3.5 font-extrabold uppercase tracking-[0.08em]">Recipient</th>
                  <th className="px-4 py-3.5 font-extrabold uppercase tracking-[0.08em]">Subject</th>
                  <th className="px-4 py-3.5 font-extrabold uppercase tracking-[0.08em]">Sender</th>
                  <th className="px-4 py-3.5 font-extrabold uppercase tracking-[0.08em]">Sent Time</th>
                  <th className="px-4 py-3.5 font-extrabold uppercase tracking-[0.08em]">Ethereal</th>
                  <th className="px-4 py-3.5 font-extrabold uppercase tracking-[0.08em]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black/10 bg-white">
                {emails.map((email, idx) => (
                  <tr
                    key={email.id}
                    className={`transition-colors hover:bg-[#fff8e6] ${idx % 2 === 1 ? 'bg-[#fbfbfb]' : ''}`}
                  >
                    <td className="px-4 py-3.5 font-extrabold text-black">{email.recipient}</td>
                    <td className="max-w-[220px] truncate px-4 py-3.5 font-medium text-[#272727]" title={email.subject}>
                      {email.subject}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-[#272727]">
                      {email.sender?.email ?? 'Unknown sender'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 font-medium text-[#272727]">
                      {email.sentAt ? new Date(email.sentAt).toLocaleString() : 'Pending'}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-[#272727]">
                      {email.previewUrl ? (
                        <a
                          href={email.previewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full font-extrabold text-black underline decoration-black decoration-2 underline-offset-4 transition hover:text-[#a15c00]"
                        >
                          Open preview
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        </a>
                      ) : (
                        <span className="text-[#8a8a8a]">Unavailable</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-black bg-[#fff3d6] px-3 py-1 text-xs font-extrabold text-black">
                        <span className="h-1.5 w-1.5 rounded-full bg-black" />
                        {email.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}