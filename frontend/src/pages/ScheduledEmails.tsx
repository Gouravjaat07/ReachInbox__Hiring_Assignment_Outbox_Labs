import { useEffect, useMemo, useState } from 'react';
import { emailApi } from '../services/api';
import type { Email } from '../types';

const STATUS_STYLES: Record<string, string> = {
  scheduled: 'bg-[#ffe17c] text-black',
  pending: 'bg-[#ffe17c] text-black',
  sent: 'bg-[#d9f7e3] text-black',
  delivered: 'bg-[#d9f7e3] text-black',
  failed: 'bg-[#ffb3b3] text-black',
  cancelled: 'bg-slate-200 text-black',
};

function statusClass(status: string) {
  return STATUS_STYLES[status.toLowerCase()] ?? 'bg-slate-200 text-black';
}

export function ScheduledEmails() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setEmails(await emailApi.scheduled());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scheduled emails');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, []);

  const filteredEmails = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return emails;
    return emails.filter(
      (email) =>
        email.recipient.toLowerCase().includes(q) ||
        email.subject.toLowerCase().includes(q) ||
        (email.sender?.email ?? '').toLowerCase().includes(q),
    );
  }, [emails, query]);

  const counts = useMemo(() => {
    const tally: Record<string, number> = {};
    for (const email of emails) {
      const key = email.status.toLowerCase();
      tally[key] = (tally[key] ?? 0) + 1;
    }
    return tally;
  }, [emails]);

  return (
    <div className="rounded-3xl border-2 border-black bg-white p-6 shadow-[8px_8px_0_#000]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-black">Scheduled emails</h1>
          <p className="mt-2 text-sm font-medium text-[#272727]">Delayed jobs waiting in the queue</p>
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
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {emails.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-full border-2 border-black px-3 py-1 text-xs font-bold text-black">
            {emails.length} total
          </span>
          {Object.entries(counts).map(([status, count]) => (
            <span
              key={status}
              className={`rounded-full border-2 border-black px-3 py-1 text-xs font-bold capitalize ${statusClass(status)}`}
            >
              {count} {status}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-5 relative sm:max-w-sm">
        <svg
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8a8a]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by recipient, subject, or sender"
          className="w-full rounded-full border-2 border-black bg-white py-2.5 pl-10 pr-4 text-sm font-medium text-black outline-none transition focus:shadow-[3px_3px_0_#000]"
        />
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
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl border-2 border-black/10 bg-[#f5f5f5]" />
          ))}
        </div>
      ) : null}

      {!loading && !error && filteredEmails.length === 0 ? (
        <div className="mt-6 rounded-2xl border-2 border-dashed border-black p-8 text-center">
          <p className="text-sm font-bold text-black">
            {emails.length === 0 ? 'No scheduled emails found.' : 'No emails match your search.'}
          </p>
          <p className="mt-1 text-xs font-medium text-[#5a5a5a]">
            {emails.length === 0 ? 'Compose a campaign to see jobs queued here.' : 'Try a different recipient, subject, or sender.'}
          </p>
        </div>
      ) : null}

      {!loading && filteredEmails.length > 0 ? (
        <div className="mt-6 overflow-hidden rounded-2xl border-2 border-black shadow-[6px_6px_0_#000]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y-2 divide-black text-sm">
              <thead className="bg-[#ffe17c] text-left text-black">
                <tr>
                  <th className="px-4 py-3.5 font-extrabold uppercase tracking-[0.08em]">Recipient</th>
                  <th className="px-4 py-3.5 font-extrabold uppercase tracking-[0.08em]">Subject</th>
                  <th className="px-4 py-3.5 font-extrabold uppercase tracking-[0.08em]">Sender</th>
                  <th className="px-4 py-3.5 font-extrabold uppercase tracking-[0.08em]">Scheduled time</th>
                  <th className="px-4 py-3.5 font-extrabold uppercase tracking-[0.08em]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black/10 bg-white">
                {filteredEmails.map((email, i) => (
                  <tr
                    key={email.id}
                    className={`transition-colors hover:bg-[#fff8e6] ${i % 2 === 1 ? 'bg-[#fbfbfb]' : ''}`}
                  >
                    <td className="px-4 py-3.5 font-extrabold text-black">{email.recipient}</td>
                    <td className="max-w-xs truncate px-4 py-3.5 font-medium text-[#272727]" title={email.subject}>
                      {email.subject}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-[#272727]">
                      {email.sender?.email ?? 'Unknown sender'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 font-medium text-[#272727]">
                      {new Date(email.scheduledAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border-2 border-black px-3 py-1 text-xs font-extrabold capitalize ${statusClass(email.status)}`}
                      >
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