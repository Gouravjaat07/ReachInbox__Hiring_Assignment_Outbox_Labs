import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { campaignApi, emailApi, senderApi } from '../services/api';
import type { Campaign, Email, Sender, User } from '../types';

function StatCard(props: { label: string; value: string; hint: string; tone: string }) {
  return (
    <div className="rounded-2xl border-2 border-black bg-white p-5 shadow-[6px_6px_0_#000]">
      <div className={`inline-flex rounded-full border-2 border-black px-3 py-1 text-xs font-extrabold ${props.tone}`}>
        {props.label}
      </div>
      <div className="mt-4 text-3xl font-extrabold text-black">{props.value}</div>
      <div className="mt-2 text-sm font-medium text-[#272727]">{props.hint}</div>
    </div>
  );
}

export function Dashboard(props: { user: User }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [scheduled, setScheduled] = useState<Email[]>([]);
  const [sent, setSent] = useState<Email[]>([]);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([campaignApi.list(), emailApi.scheduled(), emailApi.sent(), senderApi.list()])
      .then(([campaignList, scheduledList, sentList, senderList]) => {
        if (!active) return;
        setCampaigns(campaignList);
        setScheduled(scheduledList);
        setSent(sentList);
        setSenders(senderList);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const totalCampaigns = campaigns.length;
  const totalScheduled = scheduled.length;
  const totalSent = sent.length;
  const failedCount = campaigns.reduce((sum, campaign) => sum + (campaign.emails?.filter((email) => email.status === 'FAILED').length ?? 0), 0);
  const recentActivity = [...sent.slice(0, 3), ...scheduled.slice(0, 3)].slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Header banner — same dotted, yellow, black-bordered treatment as the marketing hero */}
      <section className="relative overflow-hidden rounded-3xl border-2 border-black bg-[#ffe17c] p-6 shadow-[8px_8px_0_#000] [background-image:radial-gradient(circle,rgba(0,0,0,0.12)_1.5px,transparent_1.5px)] [background-size:28px_28px] sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="mb-3 inline-block rounded-full border-2 border-black bg-white px-3 py-1 text-xs font-extrabold uppercase tracking-[0.2em] text-black">
              Dashboard
            </span>
            <h1 className="text-[clamp(1.9rem,4vw,3rem)] font-extrabold leading-[1.05] text-black">
              Welcome back, {props.user.name.split(' ')[0]}
            </h1>
            <p className="mt-3 max-w-2xl font-medium text-[#272727]">
              Compose new campaigns, monitor scheduled jobs, and keep your sending pipeline under control.
            </p>
          </div>
          <Link
            to="/dashboard/compose"
            className="inline-flex cursor-pointer items-center justify-center rounded-full border-2 border-black bg-black px-6 py-3.5 font-extrabold text-white shadow-[6px_6px_0_#000] transition-shadow duration-150 hover:shadow-[3px_3px_0_#000]"
          >
            Compose New Email
          </Link>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border-2 border-black bg-[#ffb3b3] px-4 py-3 text-sm font-bold text-black shadow-[4px_4px_0_#000]">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Campaigns" value={loading ? '...' : String(totalCampaigns)} hint="All campaigns created by your account" tone="bg-[#fff3d6] text-black" />
        <StatCard label="Scheduled" value={loading ? '...' : String(totalScheduled)} hint="Queued but not yet sent" tone="bg-[#d9f7e3] text-black" />
        <StatCard label="Sent" value={loading ? '...' : String(totalSent)} hint="Successfully delivered messages" tone="bg-white text-black" />
        <StatCard label="Failed" value={loading ? '...' : String(failedCount)} hint="Items needing review or retry" tone="bg-[#FFB3B3] text-black" />
      </section>


      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border-2 border-black bg-white p-6 shadow-[8px_8px_0_#000]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold text-black">Recent activity</h2>
              <p className="text-sm font-medium text-[#272727]">Latest scheduled and delivered emails</p>
            </div>
            <div className="rounded-full border-2 border-black bg-white px-3 py-1 text-xs font-extrabold text-black">
              {senders.length} sender{senders.length === 1 ? '' : 's'}
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {recentActivity.length === 0 && !loading ? (
              <div className="rounded-2xl border-2 border-dashed border-black p-8 text-center text-sm font-bold text-[#272727]">
                No activity yet.
              </div>
            ) : null}
            {recentActivity.map((email) => (
              <div
                key={email.id}
                className="flex flex-col gap-2 rounded-2xl border-2 border-black bg-white p-4 shadow-[4px_4px_0_#000] sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-extrabold text-black">{email.recipient}</div>
                  <div className="text-sm font-medium text-[#272727]">{email.subject}</div>
                </div>
                <div className="rounded-full border-2 border-black bg-[#ffe17c] px-3 py-1 text-xs font-extrabold text-black">
                  {email.status} • {new Date(email.scheduledAt || email.sentAt || email.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border-2 border-black bg-black p-6 text-white shadow-[8px_8px_0_#000]">
          <h2 className="text-xl font-extrabold">Campaign summary</h2>
          <p className="mt-2 text-sm font-medium text-white/70">All data below comes from the live API.</p>
          <div className="mt-6 space-y-4 text-sm">
            {campaigns.slice(0, 4).map((campaign) => (
              <div key={campaign.id} className="rounded-xl border-2 border-white/20 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-bold">{campaign.subject}</div>
                  <div className="rounded-full border-2 border-[#ff9900] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#ff9900]">
                    {campaign.status}
                  </div>
                </div>
                <div className="mt-2 text-white/70">{campaign.emails?.length ?? 0} emails</div>
              </div>
            ))}
            {!campaigns.length && !loading ? (
              <div className="rounded-xl border-2 border-white/20 bg-white/5 p-4 text-white/70">No campaigns yet.</div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}