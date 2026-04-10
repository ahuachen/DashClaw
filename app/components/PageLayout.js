'use client';

import Sidebar from './Sidebar';
import NotificationCenter from './NotificationCenter';
import AgentFilterDropdown from './AgentFilterDropdown';
import UserMenu from './UserMenu';
import RealtimeIndicator from './RealtimeIndicator';
import DemoBanner from './DemoBanner';
import SystemStatusBar from './SystemStatusBar';

const MATURITY_BADGE = {
  stable: { label: 'Stable', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  beta: { label: 'Beta', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  experimental: { label: 'Experimental', color: 'bg-surface-tertiary text-zinc-400 border-border-hover' },
};

export default function PageLayout({ title, subtitle, breadcrumbs, actions, maturity, children }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <DemoBanner />
        {/* Page header */}
        <header className="sticky top-0 z-10 bg-surface-primary/80 backdrop-blur-sm border-b border-border">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div className="min-w-0">
              {breadcrumbs && (
                <nav aria-label="Breadcrumb" className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  {breadcrumbs.map((crumb, i) => (
                    <span key={i} className="flex items-center gap-1.5">
                      {i > 0 && <span aria-hidden="true" className="text-zinc-700">/</span>}
                      <span className={i === breadcrumbs.length - 1 ? 'text-zinc-300' : ''}>
                        {crumb}
                      </span>
                    </span>
                  ))}
                </nav>
              )}
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white truncate">{title}</h1>
                {maturity && MATURITY_BADGE[maturity] && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-[0.08em] border shrink-0 ${MATURITY_BADGE[maturity].color}`}>
                    {MATURITY_BADGE[maturity].label}
                  </span>
                )}
              </div>
              {subtitle && <p className="mt-1 hidden text-sm text-zinc-400 sm:block">{subtitle}</p>}
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
