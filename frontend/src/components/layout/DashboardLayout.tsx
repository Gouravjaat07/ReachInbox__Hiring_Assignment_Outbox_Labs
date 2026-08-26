import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { User } from '../../types';

const navItems = [
  { to: '/dashboard', label: 'Overview' },
  { to: '/dashboard/compose', label: 'Compose' },
  { to: '/dashboard/scheduled', label: 'Scheduled' },
  { to: '/dashboard/sent', label: 'Sent' },
  { to: '/dashboard/failed', label: 'Failed' },
];

export function DashboardLayout(props: {
  user: User;
  onLogout: () => void;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#fff8e6] text-black">
      <header className="sticky top-0 z-20 border-b-2 border-black bg-[#232f3e] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-[0.35em] text-[#ff9900]">ReachInbox</div>
            <div className="text-sm font-medium text-white/70">Email job scheduler</div>
          </div>
          <nav className="hidden items-center gap-1 rounded-xl border-2 border-white/20 bg-white/5 p-1 md:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-lg px-4 py-2 text-sm font-extrabold transition ${
                    isActive
                      ? 'border-2 border-black bg-[#ff9900] text-black shadow-[3px_3px_0_#000]'
                      : 'border-2 border-transparent text-white/80 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-extrabold text-white">{props.user.name}</div>
              <div className="text-xs font-medium text-white/70">{props.user.email}</div>
            </div>
            {props.user.avatar ? (
              <img
                src={props.user.avatar}
                alt={props.user.name}
                className="h-11 w-11 rounded-full border-2 border-white object-cover"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-[#ff9900] text-sm font-extrabold text-black">
                {props.user.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <button
              onClick={props.onLogout}
              className="cursor-pointer rounded-xl border-2 border-black bg-white px-4 py-2 text-sm font-extrabold text-black shadow-[3px_3px_0_#000] transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0_#000]"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{props.children}</main>
    </div>
  );
}