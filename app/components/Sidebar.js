'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isDemoMode } from '../lib/isDemoMode';
import {
  Radar, Zap, ShieldAlert, Users, KeyRound,
  Settings, BarChart3, Clock, PanelLeftClose,
  PanelLeft, Menu, X, Activity, Shield, Microscope,
  Terminal, TrendingUp, GraduationCap, Plug,
  MessageSquare, Download,
} from 'lucide-react';
import DashClawLogo from './DashClawLogo';

const navGroups = [
  {
    label: 'Governance',
    items: [
      { href: '/mission-control', icon: Radar, label: 'Mission Control' },
      { href: '/decisions', icon: Zap, label: 'Decisions' },
      { href: '/approvals', icon: Clock, label: 'Approvals' },
      { href: '/policies', icon: Shield, label: 'Policies' },
      { href: '/assumptions', icon: Microscope, label: 'Assumptions' },
    ],
  },
  {
    label: 'Observe',
    items: [
      { href: '/agents', icon: Users, label: 'Fleet' },
      { href: '/sessions', icon: Activity, label: 'Sessions' },
      { href: '/security', icon: ShieldAlert, label: 'Security' },
      { href: '/drift', icon: TrendingUp, label: 'Drift' },
      { href: '/learning', icon: GraduationCap, label: 'Learning' },
    ],
  },
  {
    label: 'Measure',
    items: [
      { href: '/quality', icon: BarChart3, label: 'Quality' },
      { href: '/prompts', icon: Terminal, label: 'Prompts' },
      { href: '/feedback', icon: MessageSquare, label: 'Feedback' },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { href: '/activity', icon: Activity, label: 'Activity' },
      { href: '/compliance/exports', icon: Download, label: 'Exports' },
    ],
  },
  {
    label: 'Configure',
    items: [
      { href: '/integrations', icon: Plug, label: 'Integrations' },
      { href: '/api-keys', icon: KeyRound, label: 'API Keys' },
      { href: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const demo = isDemoMode();
  const navRef = useRef(null);

  useEffect(() => {
    const nav = navRef.current;
    if (nav) {
      const saved = sessionStorage.getItem('sidebar-scroll');
      if (saved) nav.scrollTop = parseInt(saved, 10);
    }
  }, []);

  const handleNavScroll = useCallback((e) => {
    sessionStorage.setItem('sidebar-scroll', String(e.target.scrollTop));
  }, []);

  const isActive = (href) => {
    if (href === '/mission-control') return pathname === '/mission-control' || pathname === '/';
    return pathname.startsWith(href);
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-[rgba(255,255,255,0.06)]">
        {demo ? (
          <a
            href="https://www.dashclaw.io/"
            className="flex items-center gap-2.5 hover:opacity-90 transition-opacity"
            title="Back to dashclaw.io"
          >
            <DashClawLogo size={20} />
            {!collapsed && <span className="text-lg font-semibold text-white">DashClaw</span>}
          </a>
        ) : (
          <Link href="/mission-control" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
            <DashClawLogo size={20} />
            {!collapsed && <span className="text-lg font-semibold text-white">DashClaw</span>}
          </Link>
        )}
      </div>

      {/* Nav Groups */}
      <nav ref={navRef} onScroll={handleNavScroll} className="flex-1 overflow-y-auto py-3 px-2">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-4">
            {!collapsed && (
              <div className="px-3 mb-1.5 text-[10px] font-medium text-zinc-500 uppercase tracking-widest">
                {group.label}
              </div>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors duration-150 mb-0.5 relative ${
                    active
                      ? 'bg-white/5 text-white'
                      : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {active && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-brand rounded-r" />
                  )}
                  <Icon size={16} className="flex-shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-[rgba(255,255,255,0.06)] px-4 py-3">
        {!collapsed && (
          <div className="space-y-2">
            <div className="text-[10px] text-zinc-600">DashClaw v2.5</div>
            <div className="text-[10px] text-zinc-600">
              Powered by <Link href="/practical-systems" className="hover:text-brand transition-colors">Practical Systems</Link>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors duration-150 mt-1 text-xs"
        >
          {collapsed ? <PanelLeft size={14} /> : <PanelLeftClose size={14} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 p-2 rounded-lg bg-surface-secondary border border-[rgba(255,255,255,0.06)]"
      >
        <Menu size={18} className="text-zinc-400" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-56 bg-surface-secondary border-r border-[rgba(255,255,255,0.06)] flex flex-col">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 p-1.5 text-zinc-500 hover:text-white"
            >
              <X size={16} />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div
        className={`hidden md:flex flex-col flex-shrink-0 bg-surface-secondary border-r border-[rgba(255,255,255,0.06)] h-screen sticky top-0 z-20 transition-all duration-200 ${
          collapsed ? 'w-14' : 'w-56'
        }`}
      >
        {sidebarContent}
      </div>
    </>
  );
}
