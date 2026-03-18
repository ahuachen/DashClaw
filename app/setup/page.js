import Link from 'next/link';
import { headers } from 'next/headers';
import { getSql } from '../lib/db.js';
import { getReadinessReport, projectConnectNextStep, projectReadinessReport } from '../lib/readiness.mjs';
import { readLiveVerificationProofToken } from '../lib/liveVerificationProof.mjs';
import { getViewerContextFromCookieHeader } from '../lib/sessionViewer.mjs';
import { createFallbackOnboardingStatus, getOnboardingStatusForUserId, getViewerUserId } from '../lib/onboardingState.mjs';

import { ModeBadge } from './components/Common.js';
import { TopSummary } from './components/TopSummary.js';
import { ConnectNextStepPanel } from './components/ConnectNextStepPanel.js';
import { WorkflowPanel } from './components/WorkflowPanel.js';
import { VerificationSection } from './components/VerificationSection.js';
import { RecommendedSteps } from './components/RecommendedSteps.js';
import { ProofPanel } from './components/ProofPanel.js';
import PageLayout from '../components/PageLayout';
import { LogIn } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Setup & Verify - DashClaw',
};

function getMaskedApiKey(env) {
  const key = env.DASHCLAW_API_KEY;
  if (!key) return '';
  return key.slice(0, 8) + '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';
}

export default async function SetupPage({ searchParams }) {
  const headerStore = await headers();
  const host = headerStore.get('host') || 'localhost';
  const cookieHeader = headerStore.get('cookie') || '';
  const resolvedSearchParams = await searchParams;
  const liveProofToken = typeof resolvedSearchParams?.proof === 'string' ? resolvedSearchParams.proof : '';

  const viewer = await getViewerContextFromCookieHeader(cookieHeader, process.env);
  const liveProof = await readLiveVerificationProofToken(liveProofToken, process.env);
  const report = await getReadinessReport(process.env, { host, liveProof });
  const view = projectReadinessReport(report, {
    isAuthenticated: viewer.isAuthenticated,
    host,
  });
  let onboarding = null;
  if (viewer.isAuthenticated) {
    try {
      onboarding = await getOnboardingStatusForUserId(getViewerUserId(viewer), {
        sql: getSql(),
        env: process.env,
      });
    } catch {
      onboarding = createFallbackOnboardingStatus();
    }
  }
  const connectNextStep = projectConnectNextStep({
    isAuthenticated: viewer.isAuthenticated,
    verification: view.verification,
    onboarding,
    host,
    sdk: view.sdk,
  });
  const proofDownloadHref = liveProofToken
    ? `/api/setup/proof?proof=${encodeURIComponent(liveProofToken)}&download=1`
    : '/api/setup/proof?download=1';

  const maskedApiKey = getMaskedApiKey(process.env);
  const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
  const fullHost = `${protocol}://${host}`;

  return (
    <PageLayout
      title="Setup & Verify"
      subtitle="Verify the instance, test your connection, and start governing agent actions."
      breadcrumbs={['System', 'Settings']}
      actions={
        <div className="flex items-center gap-2">
          {!viewer.isAuthenticated && (
            <Link
              href="/login"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand/10 border border-brand/20 text-brand text-xs font-medium hover:bg-brand/20 transition-colors"
            >
              <LogIn size={14} />
              Sign In
            </Link>
          )}
          <ModeBadge isAuthenticated={viewer.isAuthenticated} />
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ═══ Left Column: Connection & Verification ═══ */}
        <div className="lg:col-span-2 space-y-6">
          {/* Host + Summary */}
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-mono">
              Host: <span className="text-zinc-400">{host}</span>
            </div>
          </div>

          <TopSummary view={view} proofDownloadHref={proofDownloadHref} />

          <ConnectNextStepPanel
            maskedApiKey={maskedApiKey}
            host={fullHost}
            isAuthenticated={viewer.isAuthenticated}
            overallState={view.verification.overall}
          />

          {view.notice ? (
            <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111] px-5 py-4">
              <p className="text-sm text-zinc-300">{view.notice}</p>
            </div>
          ) : null}
          {liveProofToken && !liveProof ? (
            <div className="rounded-2xl border border-red-900/50 bg-[#111] px-5 py-4">
              <p className="text-sm text-red-300">
                The supplied live validation proof token could not be verified. Run the validator again and use the latest setup URL it returns.
              </p>
            </div>
          ) : null}

          {/* Verification sections */}
          <div className="space-y-4">
            {view.sections.map((section) => (
              <VerificationSection key={section.id} section={section} />
            ))}
            <RecommendedSteps recommendations={view.recommendations} />
          </div>

          <WorkflowPanel workflow={view.workflow} />
        </div>

        {/* ═══ Right Column: Quick Access ═══ */}
        <div className="space-y-6">
          {/* Quick Links */}
          <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111] p-5">
            <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-4">Quick Links</div>
            <div className="space-y-2">
              <Link href="/integrations" className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors group">
                <span className="text-sm text-zinc-300 group-hover:text-white">Integrations</span>
                <span className="text-[10px] text-zinc-600">Configure services</span>
              </Link>
              <Link href="/webhooks" className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors group">
                <span className="text-sm text-zinc-300 group-hover:text-white">Webhooks</span>
                <span className="text-[10px] text-zinc-600">Event notifications</span>
              </Link>
              <Link href="/usage" className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors group">
                <span className="text-sm text-zinc-300 group-hover:text-white">Usage & Billing</span>
                <span className="text-[10px] text-zinc-600">Token spend</span>
              </Link>
              <Link href="/api-keys" className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors group">
                <span className="text-sm text-zinc-300 group-hover:text-white">API Keys</span>
                <span className="text-[10px] text-zinc-600">Manage keys</span>
              </Link>
              <Link href="/docs" className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors group">
                <span className="text-sm text-zinc-300 group-hover:text-white">API Documentation</span>
                <span className="text-[10px] text-zinc-600">Reference</span>
              </Link>
              <Link href="/self-host" className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors group">
                <span className="text-sm text-zinc-300 group-hover:text-white">Deployment Guide</span>
                <span className="text-[10px] text-zinc-600">Self-host docs</span>
              </Link>
            </div>
          </div>

          {/* Instance Info */}
          <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111] p-5">
            <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-4">Instance</div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Version</span>
                <span className="text-xs text-white font-mono">v2.5</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Mode</span>
                <span className={`text-xs font-medium ${view.verification?.overall === 'green' ? 'text-emerald-400' : 'text-yellow-400'}`}>
                  {process.env.DASHCLAW_MODE === 'demo' ? 'Demo' : 'Self-Hosted'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Database</span>
                <span className={`text-xs font-medium ${view.sections?.find(s => s.id === 'database')?.status === 'green' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {view.sections?.find(s => s.id === 'database')?.status === 'green' ? 'Connected' : 'Not Connected'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Auth</span>
                <span className={`text-xs font-medium ${viewer.isAuthenticated ? 'text-emerald-400' : 'text-zinc-500'}`}>
                  {viewer.isAuthenticated ? 'Configured' : 'Not configured'}
                </span>
              </div>
            </div>
          </div>

          {/* Environment */}
          <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111] p-5">
            <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-4">Environment</div>
            <div className="space-y-3">
              <div>
                <div className="text-[10px] text-zinc-600 mb-1">Host</div>
                <div className="text-xs font-mono text-zinc-400 bg-black/40 p-2 rounded break-all border border-white/5">{host}</div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-600 mb-1">API Key</div>
                <div className="text-xs font-mono text-zinc-400 bg-black/40 p-2 rounded break-all border border-white/5">
                  {maskedApiKey || 'Not set'}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-600 mb-1">Runtime</div>
                <div className="text-xs font-mono text-zinc-400 bg-black/40 p-2 rounded border border-white/5">
                  Node {typeof process !== 'undefined' ? process.version : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Proof Panel */}
          <ProofPanel view={view} proofDownloadHref={proofDownloadHref} />

          {/* Auth Status */}
          <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111] p-5">
            <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3">Session</div>
            {viewer.isAuthenticated ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-sm text-emerald-400">Authenticated</span>
                </div>
                <Link href="/mission-control" className="block text-center py-2 px-4 rounded-lg bg-brand/10 border border-brand/20 text-brand text-sm font-medium hover:bg-brand/20 transition-colors">
                  Go to Mission Control
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-zinc-600" />
                  <span className="text-sm text-zinc-500">Not signed in</span>
                </div>
                <Link href="/login" className="block text-center py-2 px-4 rounded-lg bg-white/5 border border-white/10 text-zinc-300 text-sm font-medium hover:bg-white/10 transition-colors">
                  Sign In
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
