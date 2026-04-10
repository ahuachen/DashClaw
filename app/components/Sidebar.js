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
  MessageSquare, Download, Workflow, Cpu, BookOpen, Wrench, Fingerprint, Bell,
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
      { href: '/analytics', icon: TrendingUp, label: 'Analytics' },
      { href: '/quality', icon: BarChart3, label: 'Quality' },
      { href: '/prompts', icon: Terminal, label: 'Prompts' },
      { href: '/feedback', icon: MessageSquare, label: 'Feedback' },
    ],
  },
  {
    label: 'Studio',
    items: [
      { href: '/workflows', icon: Workflow, label: 'Workflows' },
      { href: '/model-strategies', icon: Cpu, label: 'Model Strategies' },
      { href: '/knowledge', icon: BookOpen, label: 'Knowledge' },
      { href: '/capabilities', icon: Wrench, label: 'Capabilities' },
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
      { href: '/webhooks', icon: Bell, label: 'Webhooks' },
      { href: '/api-keys', icon: KeyRound, label: 'API Keys' },
      { href: '/identities', icon: Fingerprint, label: 'Identities' },
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
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-5">
        {demo ? (
          <a
            href="https://www.dashclaw.io/"
            className="flex items-center gap-2.5 transition-opacity hover:opacity-90"
            title="Back to dashclaw.io"
          >
            <DashClawLogo size={20} />
            {!collapsed && <span className="text-lg font-semibold text-white">DashClaw</span>}
          </a>
        ) : (
          <Link href="/mission-control" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
            <DashClawLogo size={20} />
            {!collapsed && <span className="text-lg font-semibold text-white">DashClaw</span>}
          </Link>
        )}
      </div>

      {/* Nav Groups */}
      <nav
        ref={navRef}
        onScroll={handleNavScroll}
        aria-label="Primary"
        className="flex-1 overflow-y-auto px-2 py-3"
      >
        {navGroups.map((group) => (
          <div key={group.label} className="mb-4">
            {!collapsed && (
              <div className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
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
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setMobileOpen(false)}
                  title={collapsed ? item.label : undefined}
                  className={`relative mb-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150 ${
                    active
                      ? 'bg-white/5 text-white'
                      : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {active && (
                    <span aria-hidden="true" className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r bg-brand" />
                  )}
                  <Icon size={16} className={`shrink-0 ${active ? 'text-brand' : ''}`} aria-hidden="true" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-border px-4 py-3">
        {!collapsed && (
          <div className="space-y-1">
            <div className="text-[11px] tabular-nums text-zinc-500">DashClaw v2.5</div>
            <div className="text-[11px] text-zinc-500">
              Powered by{' '}
              <Link href="/practical-systems" className="text-zinc-400 transition-colors hover:text-brand">
                Practical Systems
              </Link>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-pressed={collapsed}
          className="mt-2 hidden items-center gap-2 rounded text-xs text-zinc-500 transition-colors hover:text-zinc-300 md:flex"
        >
          {collapsed ? <PanelLeft size={14} aria-hidden="true" /> : <PanelLeftClose size={14} aria-hidden="true" />}
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
        aria-label="Open navigation"
        aria-expanded={mobileOpen}
        className="fixed left-3 top-3 z-50 rounded-lg border border-border bg-surface-secondary p-2 transition-colors hover:border-border-hover md:hidden"
      >
        <Menu size={18} className="text-zinc-400" aria-hidden="true" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute bottom-0 left-0 top-0 flex w-56 flex-col border-r border-border bg-surface-secondary">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
              className="absolute right-3 top-3 rounded p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
            >
              <X size={16} aria-hidden="true" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div
        className={`sticky top-0 z-20 hidden h-screen shrink-0 flex-col border-r border-border bg-surface-secondary transition-all duration-200 md:flex ${
          collapsed ? 'w-14' : 'w-56'
        }`}
      >
        {sidebarContent}
      </div>
    </>
  );
}
