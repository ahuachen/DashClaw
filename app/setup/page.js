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
import { FooterLinks } from './components/FooterLinks.js';
import PageLayout from '../components/PageLayout';
import { LogIn } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Setup & Verify - DashClaw',
};

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

  return (
    <PageLayout 
      title="Setup & Verify"
      subtitle="Verify the instance, inspect what was actually checked, and export a proof artifact."
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
      <div className="mx-auto max-w-5xl">
        {/* Readiness Info */}
        <div className="mb-6 flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-mono">
            Host: <span className="text-zinc-400">{host}</span>
          </div>
        </div>

        <TopSummary view={view} proofDownloadHref={proofDownloadHref} />
        <ConnectNextStepPanel step={connectNextStep} />

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

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]">
          <div className="space-y-4">
            <WorkflowPanel workflow={view.workflow} />
            {view.sections.map((section) => (
              <VerificationSection key={section.id} section={section} />
            ))}
            <RecommendedSteps recommendations={view.recommendations} />
          </div>

          <div className="space-y-4">
            <ProofPanel view={view} proofDownloadHref={proofDownloadHref} />
            <FooterLinks
              isAuthenticated={viewer.isAuthenticated}
              authReady={view.auth.ok}
              verificationOverall={view.verification.overall}
            />
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
