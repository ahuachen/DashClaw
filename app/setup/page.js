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
  const report = await getReadinessReport(process.env);
  const view = projectReadinessReport(report, { isAuthenticated: viewer.isAuthenticated });

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <p className="mb-2 text-xs uppercase tracking-widest text-zinc-500">DashClaw</p>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Setup &amp; Verify</h1>
              <p className="mt-1 text-sm text-zinc-500">{host}</p>
            </div>
            <ModeBadge isAuthenticated={view.isAuthenticated} />
          </div>
        </div>

        <OverallBanner overall={view.overall} checkedAt={view.checkedAt} />

        {view.notice ? (
          <div className="mt-4 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#111] px-5 py-4">
            <p className="text-sm text-zinc-300">{view.notice}</p>
          </div>
        ) : null}

        <div className="mt-6 space-y-4">
          {view.sections.map((section) => (
            <ReadinessSection key={section.id} section={section} />
          ))}
        </div>

        <RecommendedSteps recommendations={view.recommendations} />

        <FooterLinks
          isAuthenticated={view.isAuthenticated}
          authReady={view.auth.ok}
          overall={view.overall}
        />
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

function OverallBanner({ overall, checkedAt }) {
  const config = {
    healthy: {
      label: 'Healthy',
      summary: 'Core readiness checks pass. This instance is ready to use.',
      dot: 'bg-emerald-400',
      border: 'border-emerald-900/40',
      text: 'text-emerald-400',
    },
    needs_attention: {
      label: 'Needs attention',
      summary: 'Core checks pass, but some follow-up configuration is still recommended.',
      dot: 'bg-amber-400',
      border: 'border-amber-900/40',
      text: 'text-amber-400',
    },
    blocked: {
      label: 'Blocked',
      summary: 'One or more required setup checks are failing.',
      dot: 'bg-red-400',
      border: 'border-red-900/50',
      text: 'text-red-400',
    },
  }[overall] || {
    label: 'Unknown',
    summary: 'DashClaw could not determine readiness.',
    dot: 'bg-zinc-400',
    border: 'border-zinc-700',
    text: 'text-zinc-400',
  };

  const timestamp = checkedAt
    ? new Date(checkedAt).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null;

  return (
    <div className={`rounded-xl border bg-[#111] px-5 py-4 ${config.border}`}>
      <div className="flex items-center gap-3">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${config.dot}`} />
        <div>
          <p className={`text-sm font-semibold ${config.text}`}>{config.label}</p>
          <p className="mt-0.5 text-xs text-zinc-500">{config.summary}</p>
        </div>
      </div>
      {timestamp ? (
        <p className="mt-3 text-[10px] text-zinc-600">
          Checked at {timestamp} (server time) {' '}
          <a href="/setup" className="underline underline-offset-2 transition-colors hover:text-zinc-400">
            Reload
          </a>
        </p>
      ) : null}
    </div>
  );
}

function ReadinessSection({ section }) {
  const headerColor = {
    pass: 'text-emerald-400',
    fail: 'text-red-400',
    warn: 'text-amber-400',
    info: 'text-zinc-400',
  }[section.status] || 'text-zinc-400';

  const icon = {
    pass: 'OK',
    fail: '!!',
    warn: '!',
    info: 'i',
  }[section.status] || 'i';

  return (
    <div className="overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#111]">
      <div className="flex items-center gap-3 border-b border-[rgba(255,255,255,0.06)] px-5 py-3">
        <span className={`text-xs font-bold ${headerColor}`}>{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-200">{section.title}</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">{section.description}</p>
          {section.summary ? <p className="mt-1 text-xs text-zinc-400">{section.summary}</p> : null}
        </div>
      </div>

      <div className="divide-y divide-[rgba(255,255,255,0.04)]">
        {section.checks.map((check) => (
          <CheckRow key={check.id} check={check} />
        ))}

        {section.id === 'sdk' ? <SdkCommands /> : null}
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
    info: 'text-zinc-500',
  }[check.status] || 'text-zinc-500';

  return (
    <div className="px-5 py-4">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 w-4 shrink-0 text-xs font-bold ${iconColor}`}>{icon}</span>
        <div className="min-w-0">
          <p className="text-sm text-zinc-200">{check.label}</p>
          {check.detail ? <p className="mt-0.5 text-xs text-zinc-400">{check.detail}</p> : null}
          {check.subDetail ? <p className="mt-1 text-xs text-zinc-500">{check.subDetail}</p> : null}
          {check.likelyCause ? (
            <p className="mt-2 text-xs text-zinc-500">
              Likely cause: {check.likelyCause}
            </p>
          ) : null}
          {check.nextAction ? (
            <p className="mt-1 text-xs text-zinc-400">
              Next action: {check.nextAction}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SdkCommands() {
  return (
    <div className="space-y-4 px-5 py-4">
      <div>
        <p className="text-xs text-zinc-400">Node.js validation</p>
        <CodeBlock>{`node .claude/skills/dashclaw-platform-intelligence/scripts/validate-integration.mjs \\
  --base-url https://your-dashclaw-host \\
  --api-key <api-key> \\
  --full`}</CodeBlock>
      </div>
      <div>
        <p className="text-xs text-zinc-400">Python validation</p>
        <CodeBlock>{`pip install dashclaw
python -c "from dashclaw import DashClaw; dc = DashClaw(base_url='https://your-dashclaw-host', api_key='<api-key>'); print(dc.ping())"`}</CodeBlock>
      </div>
    </div>
  );
}

function RecommendedSteps({ recommendations }) {
  if (!recommendations?.length) return null;

  return (
    <div className="mt-8">
      <p className="mb-3 text-xs uppercase tracking-widest text-zinc-500">Recommended next steps</p>
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
    <div className={`rounded-xl border bg-[#111] p-5 ${borderColor}`}>
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

function FooterLinks({ isAuthenticated, authReady, overall }) {
  return (
    <div className="mt-10 flex flex-wrap gap-4 text-sm text-zinc-500">
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
      {isAuthenticated && overall === 'healthy' ? (
        <Link href="/dashboard" className="font-medium text-brand transition-colors hover:text-brand">
          Go to dashboard -&gt;
        </Link>
      ) : null}
    </div>
  );
}

function CodeBlock({ children }) {
  return (
    <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#0d0d0d] px-4 py-3 text-xs font-mono text-zinc-300">
      {children}
    </pre>
  );
}
