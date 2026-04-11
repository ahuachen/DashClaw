'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  CheckCircle2, Check, X, Loader2, ShieldAlert, Info,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import DashClawLogo from '../components/DashClawLogo';
import { useRealtime } from '../hooks/useRealtime';
import { isDemoMode } from '../lib/isDemoMode';

function timeAgo(timestamp) {
  if (!timestamp) return '';
  const then = new Date(timestamp).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function safeVibrate(pattern) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Vibration unsupported — not fatal.
  }
}

function SkeletonCard() {
  return (
    <div className="h-40 animate-pulse rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#111]" />
  );
}

export default function ApprovePage() {
  const { data: session, status: sessionStatus } = useSession();
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [connected, setConnected] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pullOffset, setPullOffset] = useState(0);
  const toastTimer = useRef(null);
  const pullStartY = useRef(null);
  const scrollRef = useRef(null);

  const isDemo = isDemoMode();
  const isAdmin = session?.user?.role === 'admin';
  const canDecide = isAdmin && !isDemo;

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch('/api/actions?status=pending_approval&limit=50', {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed to load pending actions');
      const json = await res.json();
      setActions(Array.isArray(json.actions) ? json.actions : []);
    } catch {
      // Network / auth failure — surface via toast only on explicit user refresh.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial fetch once session is known (or demo mode).
  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (!session) {
      setLoading(false);
      return;
    }
    fetchPending();
  }, [sessionStatus, session, fetchPending]);

  // Service worker registration for PWA install.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Registration failures are non-fatal — the page still works.
    });
  }, []);

  // Online/offline status drives the realtime dot.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setConnected(navigator.onLine !== false);
    const handleOnline = () => setConnected(true);
    const handleOffline = () => setConnected(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Re-fetch on realtime action events.
  useRealtime((event) => {
    if (event === 'action.created' || event === 'action.updated') {
      fetchPending();
    }
  });

  const showToast = useCallback((msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const handleDecision = useCallback(async (actionId, decision) => {
    setProcessingId(actionId);
    safeVibrate(decision === 'allow' ? 10 : [10, 50, 10]);
    try {
      const res = await fetch(`/api/approvals/${actionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) {
        let message = 'Decision failed';
        try {
          const body = await res.json();
          if (body?.error) message = body.error;
        } catch {
          // Ignore JSON parse failure — fall back to default message.
        }
        throw new Error(message);
      }
      setRemovingId(actionId);
      setTimeout(() => {
        setActions((prev) => prev.filter((a) => a.action_id !== actionId));
        setRemovingId(null);
      }, 220);
    } catch (err) {
      showToast(err.message || 'Decision failed');
    } finally {
      setProcessingId(null);
    }
  }, [showToast]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPending();
  }, [fetchPending]);

  // Pull-to-refresh — only engages when already scrolled to the top.
  const onTouchStart = (e) => {
    if (!scrollRef.current) return;
    if (scrollRef.current.scrollTop <= 0) {
      pullStartY.current = e.touches[0].clientY;
    }
  };
  const onTouchMove = (e) => {
    if (pullStartY.current === null) return;
    const delta = e.touches[0].clientY - pullStartY.current;
    if (delta > 0) {
      setPullOffset(Math.min(delta, 90));
    }
  };
  const onTouchEnd = () => {
    if (pullOffset > 60 && !refreshing) {
      handleRefresh();
    }
    setPullOffset(0);
    pullStartY.current = null;
  };

  // --- Render states ---

  if (sessionStatus === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin text-zinc-500" size={24} aria-label="Loading" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-xs text-center">
          <div className="mb-4 flex justify-center"><DashClawLogo size={40} /></div>
          <h1 className="mb-2 text-base font-semibold text-white">Sign in to approve actions</h1>
          <p className="mb-6 text-sm text-zinc-400">
            Authentication is required to review and decide on pending agent actions.
          </p>
          <Link
            href="/login"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 text-sm font-semibold text-orange-400 transition-colors hover:border-orange-500/50 hover:bg-orange-500/20"
          >
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  const pendingCount = actions.length;

  return (
    <div>
      {/* Fixed header with safe-area padding for iOS notch */}
      <header
        className="fixed inset-x-0 top-0 z-20 border-b border-[rgba(255,255,255,0.06)] bg-[#0a0a0a]/90 backdrop-blur-sm"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <DashClawLogo size={20} />
            <span className="text-sm font-semibold text-white">Approvals</span>
          </div>
          <div className="flex items-center gap-1.5" role="status"
               aria-label={connected ? 'Realtime connected' : 'Realtime reconnecting'}>
            <span
              className={`h-2 w-2 rounded-full ${
                connected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
              }`}
            />
          </div>
        </div>
      </header>

      {/* Scroll container — content starts below the fixed header */}
      <div
        ref={scrollRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="px-4"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4.25rem)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 3rem)',
          transform: pullOffset > 0 ? `translateY(${pullOffset / 2}px)` : undefined,
          transition: pullOffset === 0 ? 'transform 200ms ease' : undefined,
        }}
      >
        {refreshing && (
          <div className="flex justify-center py-2" aria-hidden="true">
            <Loader2 className="animate-spin text-zinc-500" size={16} />
          </div>
        )}

        {/* Status / count bar */}
        <div className="mb-4">
          {isDemo && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-[rgba(255,255,255,0.08)] bg-white/[0.02] p-3 text-xs text-zinc-400">
              <Info size={14} className="mt-0.5 shrink-0 text-zinc-500" />
              <span>Demo mode — approvals are read-only. Self-host to decide for real agents.</span>
            </div>
          )}
          {!isDemo && !isAdmin && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
              <ShieldAlert size={14} className="mt-0.5 shrink-0 text-amber-400" />
              <span>Admin access required to approve actions.</span>
            </div>
          )}
          {loading ? (
            <div className="text-sm text-zinc-500">Loading pending actions…</div>
          ) : pendingCount === 0 ? (
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <CheckCircle2 size={16} />
              All clear — no actions pending
            </div>
          ) : (
            <div className="text-sm text-zinc-400">
              {pendingCount} {pendingCount === 1 ? 'action' : 'actions'} awaiting your decision
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : pendingCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <CheckCircle2 className="mb-4 text-emerald-400" size={48} aria-hidden="true" />
            <h2 className="mb-1 text-base font-semibold text-white">All clear</h2>
            <p className="text-sm text-zinc-400">No actions waiting for approval</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {actions.map((action) => {
              const risk = Number(action.risk_score) || 0;
              const riskColor =
                risk >= 70 ? 'text-red-400' : risk >= 40 ? 'text-amber-400' : 'text-zinc-400';
              const isProcessing = processingId === action.action_id;
              const isRemoving = removingId === action.action_id;
              return (
                <li
                  key={action.action_id}
                  className={`rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#111] p-4 transition-opacity duration-200 ${
                    isRemoving ? 'opacity-0' : 'opacity-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold text-white break-words">
                        {action.declared_goal || 'Untitled action'}
                      </h3>
                      <p className="mt-0.5 truncate text-sm text-zinc-400">
                        {action.agent_name || action.agent_id || 'unknown agent'}
                      </p>
                    </div>
                    <div
                      className={`shrink-0 text-2xl font-semibold tabular-nums ${riskColor}`}
                      aria-label={`Risk score ${risk}`}
                    >
                      {risk}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <span className="inline-flex items-center rounded-md border border-[rgba(255,255,255,0.08)] bg-white/[0.02] px-2 py-0.5 font-mono text-[11px] font-medium text-zinc-300">
                      {action.action_type || 'action'}
                    </span>
                    <span className="tabular-nums text-[11px] text-zinc-500">
                      {timeAgo(action.timestamp_start || action.created_at)}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleDecision(action.action_id, 'allow')}
                      disabled={!canDecide || isProcessing || isRemoving}
                      className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-400 transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={`Allow action ${action.action_id}`}
                    >
                      {isProcessing ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Check size={16} />
                      )}
                      Allow
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDecision(action.action_id, 'deny')}
                      disabled={!canDecide || isProcessing || isRemoving}
                      className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 text-sm font-semibold text-red-400 transition-colors hover:border-red-500/50 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={`Deny action ${action.action_id}`}
                    >
                      {isProcessing ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <X size={16} />
                      )}
                      Deny
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Toast (error feedback) */}
      {toast && (
        <div
          className="fixed inset-x-4 z-30 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-center text-sm text-red-300"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
          role="alert"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
