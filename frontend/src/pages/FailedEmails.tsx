import { useEffect, useState } from 'react';
import { emailApi } from '../services/api';
import type { Email } from '../types';

export function FailedEmails() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setEmails(await emailApi.failed());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load failed emails');
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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-black">Failed emails</h1>
          <p className="mt-2 text-sm font-medium text-[#272727]">Delivery attempts that reached their retry limit</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="rounded-full border-2 border-black bg-white px-4 py-2.5 text-sm font-extrabold shadow-[4px_4px_0_#000] disabled:opacity-60">
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      {error ? <div className="mt-6 rounded-2xl border-2 border-black bg-[#ffb3b3] px-4 py-3 text-sm font-bold">{error}</div> : null}
      {!loading && emails.length === 0 ? <div className="mt-6 rounded-2xl border-2 border-dashed border-black p-8 text-center text-sm font-bold">No failed emails.</div> : null}
      {!loading && emails.length > 0 ? (
        <div className="mt-6 overflow-x-auto rounded-2xl border-2 border-black">
          <table className="min-w-full divide-y-2 divide-black text-sm">
            <thead className="bg-[#ffb3b3] text-left"><tr><th className="px-4 py-3">Recipient</th><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Attempts</th><th className="px-4 py-3">Error</th><th className="px-4 py-3">Failed time</th></tr></thead>
            <tbody className="divide-y-2 divide-black/10">
              {emails.map((email) => <tr key={email.id}><td className="px-4 py-3 font-bold">{email.recipient}</td><td className="px-4 py-3">{email.subject}</td><td className="px-4 py-3">{email.attempts}</td><td className="max-w-md px-4 py-3">{email.errorMessage ?? 'Unknown failure'}</td><td className="whitespace-nowrap px-4 py-3">{email.failedAt ? new Date(email.failedAt).toLocaleString() : 'Unknown'}</td></tr>)}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}