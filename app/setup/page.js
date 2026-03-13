import Link from 'next/link';
import { headers } from 'next/headers';
import { getReadinessReport, projectReadinessReport } from '../lib/readiness.mjs';
import { getViewerContextFromCookieHeader } from '../lib/sessionViewer.mjs';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Setup & Verify - DashClaw',
};

export default async function SetupPage() {
  const headerStore = await headers();
  const host = headerStore.get('host') || 'localhost';
  const cookieHeader = headerStore.get('cookie') || '';

  const viewer = await getViewerContextFromCookieHeader(cookieHeader, process.env);
  const report = await getReadinessReport(process.env, { host });
  const view = projectReadinessReport(report, {
    isAuthenticated: viewer.isAuthenticated,
    host,
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-6 py-12 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <p className="mb-2 text-xs uppercase tracking-[0.35em] text-zinc-500">DashClaw</p>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Setup &amp; Verify</h1>
              <p className="mt-2 max-w-2xl text-sm text-zinc-400">
                Verify the instance, inspect what was actually checked, and export a proof artifact for the current state.
              </p>
              <p className="mt-2 text-xs text-zinc-500">{host}</p>
            </div>
            <ModeBadge isAuthenticated={view.isAuthenticated} />
          </div>
        </div>

        <TopSummary view={view} />

        {view.notice ? (
          <div className="mt-4 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111] px-5 py-4">
            <p className="text-sm text-zinc-300">{view.notice}</p>
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
            <ProofPanel view={view} />
            <FooterLinks
              isAuthenticated={view.isAuthenticated}
              authReady={view.auth.ok}
              verificationOverall={view.verification.overall}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ModeBadge({ isAuthenticated }) {
  const label = isAuthenticated ? 'Operator view' : 'Public-safe view';
  const classes = isAuthenticated
    ? 'border-emerald-900/40 text-emerald-300'
    : 'border-[rgba(255,255,255,0.08)] text-zinc-300';

  return (
    <div className={`rounded-full border px-3 py-1 text-xs ${classes}`}>
      {label}
    </div>
  );
}

function TopSummary({ view }) {
  const config = {
    verified: {
      dot: 'bg-emerald-400',
      border: 'border-emerald-900/40',
      text: 'text-emerald-300',
      accent: 'text-emerald-400',
    },
    ready_unverified: {
      dot: 'bg-cyan-400',
      border: 'border-cyan-900/40',
      text: 'text-cyan-200',
      accent: 'text-cyan-300',
    },
    needs_attention: {
      dot: 'bg-amber-400',
      border: 'border-amber-900/40',
      text: 'text-amber-200',
      accent: 'text-amber-400',
    },
    blocked: {
      dot: 'bg-red-400',
      border: 'border-red-900/50',
      text: 'text-red-200',
      accent: 'text-red-400',
    },
  }[view.verification.overall];

  const checkedAt = view.checkedAt
    ? new Date(view.checkedAt).toLocaleString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        month: 'short',
        day: 'numeric',
      })
    : '';

  return (
    <div className={`rounded-2xl border bg-[#111] p-6 ${config.border}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3">
            <span className={`h-2.5 w-2.5 rounded-full ${config.dot}`} />
            <p className={`text-sm font-semibold ${config.accent}`}>{view.verification.label}</p>
          </div>
          <p className="mt-3 text-2xl font-semibold text-white">{view.verification.summary}</p>
          <p className={`mt-2 text-sm ${config.text}`}>
            {view.verification.fullyVerified
              ? 'Core instance checks passed and operator access looks strong.'
              : 'This page separates what has already been verified from live validation that is still pending.'}
          </p>
          <p className="mt-3 text-xs text-zinc-500">
            Last checked {checkedAt} (server time)
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <ActionLink href="/api/setup/proof?download=1">Download verification proof</ActionLink>
          <ActionLink href="#workflow" secondary>
            Review verification flow
          </ActionLink>
          <ActionLink href="/setup" secondary>
            Reload checks
          </ActionLink>
        </div>
      </div>
    </div>
  );
}

function ActionLink({ href, children, secondary = false }) {
  const classes = secondary
    ? 'border-[rgba(255,255,255,0.08)] bg-transparent text-zinc-200 hover:border-[rgba(255,255,255,0.18)] hover:text-white'
    : 'border-brand/40 bg-brand/10 text-brand hover:border-brand/60 hover:bg-brand/15';

  return (
    <a
      href={href}
      className={`inline-flex items-center rounded-full border px-4 py-2 text-sm transition-colors ${classes}`}
    >
      {children}
    </a>
  );
}

function WorkflowPanel({ workflow }) {
  return (
    <div id="workflow" className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111] p-5">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Verification workflow</p>
        <p className="mt-2 text-sm text-zinc-300">
          Use this sequence to move from core readiness into live integration proof.
        </p>
      </div>

      <div className="space-y-3">
        {workflow.map((step, index) => (
          <WorkflowStep key={step.id} step={step} index={index} />
        ))}
      </div>
    </div>
  );
}

function WorkflowStep({ step, index }) {
  const styles = {
    pass: 'border-emerald-900/40 text-emerald-300',
    warn: 'border-amber-900/40 text-amber-300',
    fail: 'border-red-900/40 text-red-300',
    blocked: 'border-red-900/40 text-red-300',
    pending: 'border-cyan-900/40 text-cyan-300',
  }[step.status] || 'border-[rgba(255,255,255,0.08)] text-zinc-300';

  return (
    <div className={`rounded-xl border bg-[#0d0d0d] p-4 ${styles}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-[11px] font-semibold">
          {index + 1}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{step.title}</p>
          <p className="mt-1 text-xs text-zinc-300">{step.summary}</p>
          <p className="mt-2 text-xs text-zinc-500">Proof: {step.proof}</p>
          {step.nextAction ? <p className="mt-1 text-xs text-zinc-400">Next action: {step.nextAction}</p> : null}
        </div>
      </div>
    </div>
  );
}

function VerificationSection({ section }) {
  const headerColor = {
    pass: 'text-emerald-400',
    fail: 'text-red-400',
    warn: 'text-amber-400',
    info: 'text-cyan-300',
  }[section.status] || 'text-zinc-400';

  const icon = {
    pass: 'OK',
    fail: '!!',
    warn: '!',
    info: 'i',
  }[section.status] || 'i';

  return (
    <div className="overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111]">
      <div className="border-b border-[rgba(255,255,255,0.06)] px-5 py-4">
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 text-xs font-bold ${headerColor}`}>{icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-200">{section.title}</p>
            <p className="mt-1 text-xs text-zinc-500">{section.description}</p>
            {section.summary ? <p className="mt-2 text-sm text-zinc-300">{section.summary}</p> : null}
            {section.whatWasChecked ? (
              <p className="mt-2 text-xs text-zinc-400">What was checked: {section.whatWasChecked}</p>
            ) : null}
            {section.evidenceSummary ? (
              <p className="mt-1 text-xs text-zinc-500">Evidence: {section.evidenceSummary}</p>
            ) : null}
            {section.pendingProof ? (
              <p className="mt-1 text-xs text-zinc-500">Still pending: {section.pendingProof}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="divide-y divide-[rgba(255,255,255,0.04)]">
        {section.checks.map((check) => (
          <CheckRow key={check.id} check={check} />
        ))}

        {section.id === 'sdk' ? <SdkCommands commands={section.commands} coreReady={section.coreReady} /> : null}
      </div>
    </div>
  );
}

function CheckRow({ check }) {
  const icon = {
    pass: 'OK',
    fail: '!!',
    warn: '!',
    info: 'i',
  }[check.status] || 'i';

  const iconColor = {
    pass: 'text-emerald-400',
    fail: 'text-red-400',
    warn: 'text-amber-400',
    info: 'text-cyan-300',
  }[check.status] || 'text-zinc-500';

  return (
    <div className="px-5 py-4">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 w-4 shrink-0 text-xs font-bold ${iconColor}`}>{icon}</span>
        <div className="min-w-0">
          <p className="text-sm text-zinc-200">{check.label}</p>
          {check.detail ? <p className="mt-0.5 text-xs text-zinc-400">{check.detail}</p> : null}
          {check.subDetail ? <p className="mt-1 text-xs text-zinc-500">{check.subDetail}</p> : null}
          {check.likelyCause ? <p className="mt-2 text-xs text-zinc-500">Likely cause: {check.likelyCause}</p> : null}
          {check.nextAction ? <p className="mt-1 text-xs text-zinc-400">Next action: {check.nextAction}</p> : null}
        </div>
      </div>
    </div>
  );
}

function SdkCommands({ commands, coreReady }) {
  if (!commands) return null;

  return (
    <div className="space-y-4 px-5 py-4">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Node validation</p>
        <p className="mt-2 text-xs text-zinc-400">
          Proves a live authenticated SDK request path from a Node client.
        </p>
        <CodeBlock>{commands.node}</CodeBlock>
      </div>

      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Python validation</p>
        <p className="mt-2 text-xs text-zinc-400">
          Proves package install, auth, base URL correctness, and a live ping from Python.
        </p>
        <CodeBlock>{commands.python}</CodeBlock>
      </div>

      <p className="text-xs text-zinc-500">
        {coreReady
          ? 'These commands are guidance for live validation. This page does not claim they have already been executed.'
          : 'Run these only after the blocked core checks above have been resolved.'}
      </p>
    </div>
  );
}

function RecommendedSteps({ recommendations }) {
  if (!recommendations?.length) return null;

  return (
    <div className="mt-8">
      <p className="mb-3 text-xs uppercase tracking-[0.3em] text-zinc-500">Recommended next steps</p>
      <div className="space-y-3">
        {recommendations.map((step) => (
          <ActionBlock key={step.id} step={step} />
        ))}
      </div>
    </div>
  );
}

function ActionBlock({ step }) {
  const borderColor = {
    error: 'border-red-900/50',
    warn: 'border-amber-900/50',
    info: 'border-[rgba(255,255,255,0.08)]',
  }[step.variant] || 'border-[rgba(255,255,255,0.08)]';

  const titleColor = {
    error: 'text-red-400',
    warn: 'text-amber-400',
    info: 'text-zinc-300',
  }[step.variant] || 'text-zinc-200';

  return (
    <div className={`rounded-2xl border bg-[#111] p-5 ${borderColor}`}>
      <p className={`mb-2 text-sm font-semibold ${titleColor}`}>{step.title}</p>
      <p className="text-sm text-zinc-300">{step.summary}</p>
      {step.details?.length ? (
        <div className="mt-3 space-y-1">
          {step.details.map((detail) => (
            <p key={detail} className="text-xs text-zinc-500">
              {detail}
            </p>
          ))}
        </div>
      ) : null}
      {step.code ? (
        <div className="mt-3">
          <CodeBlock>{step.code}</CodeBlock>
        </div>
      ) : null}
      {step.note ? <p className="mt-3 text-xs text-zinc-500">{step.note}</p> : null}
    </div>
  );
}

function ProofPanel({ view }) {
  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111] p-5">
      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Verification proof</p>
      <p className="mt-3 text-sm text-zinc-300">
        Download a structured JSON artifact for the current verify view. It records what was checked, the current verification state, and the next actions that still remain.
      </p>
      <p className="mt-3 text-xs text-zinc-500">
        {view.isAuthenticated
          ? 'Operator mode includes richer diagnostics and commands when available.'
          : 'Public-safe mode is sanitized before export and hides operator-only details.'}
      </p>

      <div className="mt-4 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0d0d0d] p-4">
        <p className="text-xs text-zinc-400">Artifact includes</p>
        <div className="mt-3 space-y-2 text-xs text-zinc-500">
          <p>Timestamp, viewer mode, and overall verification state.</p>
          <p>Per-section summaries and per-check status details.</p>
          <p>Recommended next steps and SDK validation guidance.</p>
        </div>
      </div>

      <div className="mt-4">
        <a
          href="/api/setup/proof?download=1"
          className="inline-flex items-center rounded-full border border-brand/40 bg-brand/10 px-4 py-2 text-sm text-brand transition-colors hover:border-brand/60 hover:bg-brand/15"
        >
          Download JSON proof
        </a>
      </div>

      <div className="mt-4 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0d0d0d] p-4">
        <p className="text-xs text-zinc-400">Proof preview</p>
        <CodeBlock>{JSON.stringify(view.proofArtifact.verification, null, 2)}</CodeBlock>
      </div>
    </div>
  );
}

function FooterLinks({ isAuthenticated, authReady, verificationOverall }) {
  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111] p-5 text-sm text-zinc-500">
      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Operator links</p>
      <div className="mt-4 flex flex-col gap-3">
        <Link href="/self-host" className="transition-colors hover:text-zinc-300">
          Deployment guide -&gt;
        </Link>
        <Link href="/docs" className="transition-colors hover:text-zinc-300">
          API docs -&gt;
        </Link>
        {!isAuthenticated && authReady ? (
          <Link href="/login" className="transition-colors hover:text-zinc-300">
            Sign in -&gt;
          </Link>
        ) : null}
        {isAuthenticated ? (
          <Link href="/api-keys" className="transition-colors hover:text-zinc-300">
            Manage API keys -&gt;
          </Link>
        ) : null}
        {isAuthenticated && verificationOverall !== 'blocked' ? (
          <Link href="/dashboard" className="font-medium text-brand transition-colors hover:text-brand">
            Go to dashboard -&gt;
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function CodeBlock({ children }) {
  return (
    <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#050505] px-4 py-3 text-xs font-mono text-zinc-300">
      {children}
    </pre>
  );
}
