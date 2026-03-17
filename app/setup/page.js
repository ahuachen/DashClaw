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
      <div className="mx-auto max-w-2xl">
        {/* Host label */}
        <div className="mb-6 flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-mono">
            Host: <span className="text-zinc-400">{host}</span>
          </div>
        </div>

        {/* 1. TopSummary */}
        <TopSummary view={view} proofDownloadHref={proofDownloadHref} />

        {/* 2. ConnectNextStepPanel (interactive client component) */}
        <ConnectNextStepPanel
          maskedApiKey={maskedApiKey}
          host={fullHost}
          isAuthenticated={viewer.isAuthenticated}
          overallState={view.verification.overall}
        />

        {view.notice ? (
          <div className="mt-4 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111] px-5 py-4">
            <p className="text-sm text-zinc-300">{view.notice}</p>
          </div>
        ) : null}
        {liveProofToken && !liveProof ? (
          <div className="mt-4 rounded-2xl border border-red-900/50 bg-[#111] px-5 py-4">
            <p className="text-sm text-red-300">
              The supplied live validation proof token could not be verified. Run the validator again and use the latest setup URL it returns.
            </p>
          </div>
        ) : null}

        {/* 3. Verification sections (collapsed if all-green) */}
        <div className="mt-6 space-y-4">
          {view.sections.map((section) => (
            <VerificationSection key={section.id} section={section} />
          ))}
          <RecommendedSteps recommendations={view.recommendations} />
        </div>

        {/* 4. WorkflowPanel (collapsed if all-green) */}
        <div className="mt-4">
          <WorkflowPanel workflow={view.workflow} />
        </div>

        {/* 5. ProofPanel (demoted, small) */}
        <div className="mt-4">
          <ProofPanel view={view} proofDownloadHref={proofDownloadHref} />
        </div>

        {/* Footer links (plain text) */}
        <div className="mt-6 flex flex-wrap items-center gap-4 pb-4 text-xs text-zinc-500">
          <Link href="/self-host" className="transition-colors hover:text-zinc-300">
            Deployment guide
          </Link>
          <Link href="/docs" className="transition-colors hover:text-zinc-300">
            API docs
          </Link>
          {!viewer.isAuthenticated && (
            <Link href="/login" className="transition-colors hover:text-zinc-300">
              Sign in
            </Link>
          )}
          {viewer.isAuthenticated && (
            <Link href="/mission-control" className="font-medium text-brand transition-colors hover:text-brand">
              Go to dashboard
            </Link>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
