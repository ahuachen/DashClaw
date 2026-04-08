'use client';

import Sidebar from './Sidebar';
import NotificationCenter from './NotificationCenter';
import AgentFilterDropdown from './AgentFilterDropdown';
import UserMenu from './UserMenu';
import RealtimeIndicator from './RealtimeIndicator';
import DemoBanner from './DemoBanner';
import SystemStatusBar from './SystemStatusBar';

export default function PageLayout({ title, subtitle, breadcrumbs, actions, children }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <DemoBanner />
        {/* Page header */}
        <header className="sticky top-0 z-10 bg-surface-primary/80 backdrop-blur-sm border-b border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
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
              <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
              {subtitle && <p className="text-sm text-zinc-400 font-normal mt-0.5">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-3">
              <RealtimeIndicator />
              <AgentFilterDropdown />
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
