import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, emailApi, senderApi } from '../services/api';
import type { Sender } from '../types';

export function ComposeEmail() {
  const navigate = useNavigate();
  const [senders, setSenders] = useState<Sender[]>([]);
  const [senderId, setSenderId] = useState('');
  const [senderLoading, setSenderLoading] = useState(true);
  const [senderError, setSenderError] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientsText, setRecipientsText] = useState('');
  const [startTime, setStartTime] = useState(() => new Date(Date.now() + 10 * 60 * 1000).toISOString().slice(0, 16));
  const [delayMs, setDelayMs] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(200);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    senderApi
      .list()
      .then((items) => {
        if (!active) return;
        if (items.length > 0) {
          setSenders(items);
          setSenderId((currentSenderId) => (items.some((sender) => sender.id === currentSenderId) ? currentSenderId : items[0].id));
          return;
        }

        return authApi.me().then((user) => senderApi.create({ email: user.email, name: user.name }));
      })
      .then((createdSender) => {
        if (!active || !createdSender) return;
        setSenders([createdSender]);
        setSenderId(createdSender.id);
      })
      .catch((err) => {
        if (!active) return;
        setSenders([]);
        setSenderId('');
        setSenderError(err instanceof Error ? err.message : 'Failed to load senders');
      })
      .finally(() => {
        if (active) {
          setSenderLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const parseRecipients = async () => {
    if (file || recipientsText.trim()) {
      const parsed = await emailApi.parseLeads({ text: recipientsText.trim() || undefined, file: file ?? undefined });
      return parsed.emails;
    }
    return [];
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (!senderId) {
        throw new Error(senderLoading ? 'Wait for senders to load before scheduling' : 'Choose a sender before scheduling');
      }

      const recipients = await parseRecipients();
      if (recipients.length === 0) {
        throw new Error('Add at least one valid recipient before scheduling');
      }

      const result = await emailApi.schedule({
        subject,
        body,
        startTime: new Date(startTime).toISOString(),
        delayMs,
        hourlyLimit,
        senderId,
        recipients,
      });
      setSuccess(`Scheduled ${result.scheduledCount} emails. ${result.failedEnqueues} jobs need reconciliation.`);
      navigate('/dashboard/scheduled');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule campaign');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-black bg-white px-2.5 py-1.5 text-sm font-medium text-black outline-none transition focus:shadow-[2px_2px_0_#000] disabled:cursor-not-allowed disabled:bg-slate-100';

  const labelClass = 'text-[11px] font-extrabold uppercase tracking-[0.06em] text-black';

  const handleDownloadSample = () => {
    const sampleContent =
      'tempalpha01@example.com,tempbravo02@example.com,tempcobra03@example.com,tempdelta04@example.com,tempecho05@example.com,tempfoxtrot06@example.com,tempgolf07@example.com,temphotel08@example.com,tempmike09@example.com,tempromeo10@example.com';
    const blob = new Blob([sampleContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sample-recipients.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full flex-col rounded-3xl border-2 border-black bg-white p-4 shadow-[8px_8px_0_#000]">
      <div>
        <h1 className="text-xl font-extrabold text-black">Compose new email</h1>
        <p className="mt-0.5 text-xs font-medium text-[#272727]">Upload leads, choose a sender, and schedule the campaign.</p>
      </div>

      {senderError ? (
        <div className="mt-2 rounded-lg border border-black bg-[#ffe17c] px-3 py-1.5 text-xs font-bold text-black">{senderError}</div>
      ) : null}

      <form className="mt-3 grid flex-1 grid-cols-1 gap-3 lg:grid-cols-2" onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-3 lg:col-span-2">
          <label className="space-y-1">
            <span className={labelClass}>Sender</span>
            <select value={senderId} onChange={(e) => setSenderId(e.target.value)} disabled={senderLoading} className={inputClass}>
              <option value="">{senderLoading ? 'Loading senders...' : 'Select a sender'}</option>
              {senders.map((sender) => (
                <option key={sender.id} value={sender.id}>
                  {sender.name} &lt;{sender.email}&gt;
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className={labelClass}>Subject</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} />
          </label>
        </div>

        <label className="space-y-1 lg:col-span-2">
          <span className={labelClass}>Body</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className={`${inputClass} resize-none`} />
        </label>

        <label className="flex flex-col space-y-1">
          <span className={labelClass}>Recipients file (CSV/TXT)</span>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-xs font-medium text-[#272727] file:mr-3 file:cursor-pointer file:rounded-full file:border file:border-black file:bg-black file:px-2.5 file:py-1 file:text-xs file:font-extrabold file:text-white"
            />
            <button
              type="button"
              onClick={handleDownloadSample}
              className="shrink-0 cursor-pointer rounded-full border border-black bg-white px-2.5 py-1.5 text-[11px] font-extrabold text-black transition hover:bg-[#f5f5f5]"
            >
              Sample file
            </button>
          </div>
          <p className="text-[10px] font-medium text-[#5a5a5a]">
            Comma-separated email addresses on a single line, like the sample file.
          </p>
          <textarea
            value={recipientsText}
            onChange={(e) => setRecipientsText(e.target.value)}
            rows={3}
            placeholder="alice@example.com, bob@example.com"
            className={`${inputClass} resize-none`}
          />
        </label>

        <div className="grid grid-cols-3 gap-3">
          <label className="space-y-1">
            <span className={labelClass}>Start time</span>
            <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} />
          </label>

          <label className="space-y-1">
            <span className={labelClass}>Delay (ms)</span>
            <input type="number" min="100" value={delayMs} onChange={(e) => setDelayMs(Number(e.target.value))} className={inputClass} />
          </label>

          <label className="space-y-1">
            <span className={labelClass}>Hourly limit</span>
            <input type="number" min="1" value={hourlyLimit} onChange={(e) => setHourlyLimit(Number(e.target.value))} className={inputClass} />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
          <button
            disabled={loading || senderLoading || !senderId}
            className="cursor-pointer rounded-full border-2 border-black bg-black px-5 py-2 text-xs font-extrabold text-white shadow-[3px_3px_0_#000] transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0_#000] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[3px_3px_0_#000]"
          >
            {loading ? 'Scheduling...' : 'Schedule emails'}
          </button>
          <button
            type="button"
            className="cursor-pointer rounded-full border-2 border-black bg-white px-4 py-2 text-xs font-extrabold text-black transition hover:bg-[#f5f5f5]"
          >
            Save draft
          </button>
          {success ? (
            <div className="rounded-full border border-black bg-[#d9f7e3] px-3 py-1 text-xs font-bold text-black">{success}</div>
          ) : null}
          {error ? (
            <div className="rounded-full border border-black bg-[#ffb3b3] px-3 py-1 text-xs font-bold text-black">{error}</div>
          ) : null}
        </div>
      </form>
    </div>
  );
}