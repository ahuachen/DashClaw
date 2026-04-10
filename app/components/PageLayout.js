'use client';

import Sidebar from './Sidebar';
import NotificationCenter from './NotificationCenter';
import AgentFilterDropdown from './AgentFilterDropdown';
import UserMenu from './UserMenu';
import RealtimeIndicator from './RealtimeIndicator';
import DemoBanner from './DemoBanner';
import SystemStatusBar from './SystemStatusBar';

const MATURITY_BADGE = {
  stable: { label: 'Stable', color: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' },
  beta: { label: 'Beta', color: 'bg-amber-400/10 text-amber-400 border-amber-400/20' },
  experimental: { label: 'Experimental', color: 'bg-purple-400/10 text-purple-400 border-purple-400/20' },
};

export default function PageLayout({ title, subtitle, breadcrumbs, actions, maturity, children }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <DemoBanner />
        {/* Page header */}
        <header className="sticky top-0 z-10 bg-surface-primary/80 backdrop-blur-sm border-b border-[rgba(255,255,255,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div className="min-w-0">
              {breadcrumbs && (
                <div className="text-xs text-zinc-500 mb-1 flex items-center gap-1.5">
                  {breadcrumbs.map((crumb, i) => (
                    <span key={i} className="flex items-center gap-1.5">
                      {i > 0 && <span className="text-zinc-600">/</span>}
                      <span className={i === breadcrumbs.length - 1 ? 'text-zinc-400' : ''}>
                        {crumb}
                      </span>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white truncate">{title}</h1>
                {maturity && MATURITY_BADGE[maturity] && (
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium border shrink-0 ${MATURITY_BADGE[maturity].color}`}>
                    {MATURITY_BADGE[maturity].label}
                  </span>
                )}
              </div>
              {subtitle && <p className="text-sm text-zinc-400 font-normal mt-0.5 hidden sm:block">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <span className="hidden md:flex"><RealtimeIndicator /></span>
              <span className="hidden sm:flex"><AgentFilterDropdown /></span>
              {actions}
              <NotificationCenter />
              <UserMenu />
            </div>
          </div>
        </header>
        <SystemStatusBar />
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
