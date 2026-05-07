'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { isDemoMode } from '../lib/isDemoMode';
import {
  Radar, Zap, ShieldAlert, Users, KeyRound,
  Settings, BarChart3, Clock, PanelLeftClose,
  PanelLeft, Menu, X, Activity, Shield, Microscope,
  Terminal, TrendingUp, GraduationCap, Plug,
  MessageSquare, Download, Workflow, Cpu, BookOpen, Wrench, Fingerprint, Bell, Inbox,
  FlaskConical, ChevronDown,
} from 'lucide-react';
import DashClawLogo from './DashClawLogo';

export default function Sidebar() {
  const t = useTranslations('sidebar');

  const navGroups = [
    {
      label: t('groups.govern'),
      items: [
        { href: '/mission-control', icon: Radar, label: t('items.missionControl') },
        { href: '/decisions', icon: Zap, label: t('items.decisions') },
        { href: '/approvals', icon: Clock, label: t('items.approvals') },
        { href: '/policies', icon: Shield, label: t('items.policies') },
        { href: '/agents', icon: Users, label: t('items.fleet') },
      ],
    },
    {
      label: t('groups.observe'),
      items: [
        { href: '/security', icon: ShieldAlert, label: t('items.security') },
        { href: '/analytics', icon: TrendingUp, label: t('items.analytics') },
        { href: '/activity', icon: Activity, label: t('items.activity') },
        { href: '/compliance/exports', icon: Download, label: t('items.compliance') },
      ],
    },
    {
      label: t('groups.configure'),
      items: [
        { href: '/api-keys', icon: KeyRound, label: t('items.apiKeys') },
        { href: '/integrations', icon: Plug, label: t('items.integrations') },
        { href: '/webhooks', icon: Bell, label: t('items.webhooks') },
        { href: '/identities', icon: Fingerprint, label: t('items.identities') },
        { href: '/settings', icon: Settings, label: t('items.settings') },
      ],
    },
    {
      label: t('groups.labs'),
      collapsible: true,
      headerIcon: FlaskConical,
      items: [
        { href: '/assumptions', icon: Microscope, label: t('items.assumptions') },
        { href: '/sessions', icon: Activity, label: t('items.sessions') },
        { href: '/drift', icon: TrendingUp, label: t('items.drift') },
        { href: '/learning', icon: GraduationCap, label: t('items.learning') },
        { href: '/quality', icon: BarChart3, label: t('items.quality') },
        { href: '/prompts', icon: Terminal, label: t('items.prompts') },
        { href: '/feedback', icon: MessageSquare, label: t('items.feedback') },
        { href: '/messages', icon: Inbox, label: t('items.messages') },
        { href: '/workflows', icon: Workflow, label: t('items.workflows') },
        { href: '/model-strategies', icon: Cpu, label: t('items.modelStrategies') },
        { href: '/knowledge', icon: BookOpen, label: t('items.knowledge') },
        { href: '/capabilities', icon: Wrench, label: t('items.capabilities') },
      ],
    },
  ];

  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Labs group starts closed to keep the sidebar calm (principle 3).
  // The persisted value is applied in the effect below so SSR and the
  // first client render agree — avoids a hydration mismatch.
  const [labsOpen, setLabsOpen] = useState(false);
  const demo = isDemoMode();
  const navRef = useRef(null);

  useEffect(() => {
    const nav = navRef.current;
    if (nav) {
      const saved = sessionStorage.getItem('sidebar-scroll');
      if (saved) nav.scrollTop = parseInt(saved, 10);
    }
    try {
      const savedLabs = sessionStorage.getItem('sidebar-labs-open');
      if (savedLabs === 'true') setLabsOpen(true);
    } catch { /* sessionStorage may be unavailable */ }
  }, []);

  const handleNavScroll = useCallback((e) => {
    sessionStorage.setItem('sidebar-scroll', String(e.target.scrollTop));
  }, []);

  const toggleLabs = useCallback(() => {
    setLabsOpen((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem('sidebar-labs-open', String(next));
      } catch { /* sessionStorage may be unavailable */ }
      return next;
    });
  }, []);

  const isActive = (href) => {
    if (href === '/mission-control') return pathname === '/mission-control' || pathname === '/';
    return pathname.startsWith(href);
  };

  const renderNavItem = (item) => {
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
            : 'text-secondary hover:bg-white/5 hover:text-white'
        }`}
      >
        {active && (
          <span aria-hidden="true" className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r bg-brand" />
        )}
        <Icon size={16} className={`shrink-0 ${active ? 'text-brand' : ''}`} aria-hidden="true" />
        {!collapsed && <span>{item.label}</span>}
      </Link>
    );
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-5">
        {demo ? (
          <a
            href="https://www.dashclaw.io/"
            className="flex items-center gap-2.5 transition-opacity hover:opacity-90"
            title={t('backToDashclaw')}
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
        {navGroups.map((group) => {
          const isCollapsible = Boolean(group.collapsible);
          const itemsVisible = !isCollapsible || labsOpen;
          const HeaderIcon = group.headerIcon;
          const groupId = isCollapsible ? `nav-group-${group.label.toLowerCase()}` : undefined;
          return (
            <div key={group.label} className="mb-4">
              {isCollapsible ? (
                <button
                  type="button"
                  onClick={toggleLabs}
                  aria-expanded={labsOpen}
                  aria-controls={groupId}
                  title={collapsed ? group.label : undefined}
                  className={
                    collapsed
                      ? 'relative mb-1 flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm text-secondary transition-colors duration-150 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40'
                      : 'mb-1.5 flex w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-tertiary transition-colors hover:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40'
                  }
                >
                  {collapsed ? (
                    HeaderIcon ? <HeaderIcon size={16} aria-hidden="true" /> : null
                  ) : (
                    <>
                      <span className="flex items-center gap-2">
                        {HeaderIcon ? <HeaderIcon size={12} aria-hidden="true" /> : null}
                        {group.label}
                      </span>
                      <ChevronDown
                        size={12}
                        aria-hidden="true"
                        className={`shrink-0 transition-transform duration-150 motion-reduce:transition-none ${
                          labsOpen ? 'rotate-0' : '-rotate-90'
                        }`}
                      />
                    </>
                  )}
                </button>
              ) : (
                !collapsed && (
                  <div className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-tertiary">
                    {group.label}
                  </div>
                )
              )}
              <div id={groupId} hidden={!itemsVisible}>
                {group.items.map(renderNavItem)}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-border px-4 py-3">
        {!collapsed && (
          <div className="space-y-1">
            <div className="text-[11px] tabular-nums text-tertiary">DashClaw v{process.env.NEXT_PUBLIC_DASHCLAW_VERSION || '2.13.0'}</div>
            <div className="text-[11px] text-tertiary">
              {t('poweredBy')}{' '}
              <Link href="/practical-systems" className="text-secondary transition-colors hover:text-brand">
                {t('practicalSystems')}
              </Link>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-pressed={collapsed}
          className="mt-2 hidden items-center gap-2 rounded text-xs text-tertiary transition-colors hover:text-secondary md:flex"
        >
          {collapsed ? <PanelLeft size={14} aria-hidden="true" /> : <PanelLeftClose size={14} aria-hidden="true" />}
          {!collapsed && <span>{t('collapse')}</span>}
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
        <Menu size={18} className="text-secondary" aria-hidden="true" />
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
              className="absolute right-3 top-3 rounded p-1.5 text-tertiary transition-colors hover:bg-white/5 hover:text-white"
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
