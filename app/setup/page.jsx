import { projectReadinessReport, getReadinessReport } from '../lib/readiness.mjs';

function statusTone(status) {
  switch (status) {
    case 'verified':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200';
    case 'ready_unverified':
      return 'border-sky-500/40 bg-sky-500/10 text-sky-200';
    case 'needs_attention':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-200';
    default:
      return 'border-red-500/40 bg-red-500/10 text-red-200';
  }
}

function checkTone(status) {
  switch (status) {
    case 'pass':
      return 'text-emerald-300';
    case 'warn':
    case 'pending':
      return 'text-amber-300';
    case 'info':
    case 'skipped':
      return 'text-zinc-300';
    default:
      return 'text-red-300';
  }
}

function CheckList({ checks = [] }) {
  if (!checks.length) return null;

  return (
    <ul className="space-y-3">
      {checks.map((check) => (
        <li key={check.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-white">{check.label}</div>
              <div className="mt-1 text-sm text-zinc-300">{check.detail}</div>
              {check.subDetail ? (
                <div className="mt-2 text-xs text-zinc-400">{check.subDetail}</div>
              ) : null}
              {check.nextAction ? (
                <div className="mt-2 text-xs text-zinc-400">Next: {check.nextAction}</div>
              ) : null}
            </div>
            <div className={`shrink-0 text-xs font-semibold uppercase tracking-wide ${checkTone(check.status)}`}>
              {check.status}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function RecommendationList({ recommendations = [] }) {
  if (!recommendations.length) return null;

  return (
    <div className="space-y-4">
      {recommendations.map((step) => (
        <div key={step.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-white">{step.title}</h3>
            <span className={`text-xs font-semibold uppercase tracking-wide ${checkTone(step.variant === 'error' ? 'fail' : step.variant === 'warn' ? 'warn' : 'info')}`}>
              {step.variant}
            </span>
          </div>
          <p className="mt-2 text-sm text-zinc-300">{step.summary}</p>
          {Array.isArray(step.details) && step.details.length > 0 ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-400">
              {step.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}
          {step.code ? (
            <pre className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-zinc-950/80 p-3 text-xs text-zinc-200">
              <code>{step.code}</code>
            </pre>
          ) : null}
          {step.note ? <p className="mt-2 text-xs text-zinc-500">{step.note}</p> : null}
        </div>
      ))}
    </div>
  );
}

export const dynamic = 'force-dynamic';

export default async function SetupPage() {
  const report = await getReadinessReport(process.env);
  const view = projectReadinessReport(report, { isAuthenticated: true });
  const overall = view.verification;

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-300">
              Setup
            </span>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${statusTone(overall.overall)}`}>
              {overall.label}
            </span>
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold text-white">Deployment truth surface</h1>
            <p className="max-w-3xl text-base text-zinc-300">{overall.summary}</p>
            <p className="text-sm text-zinc-500">Checked at {new Date(view.checkedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-zinc-400">Readiness</div>
            <div className="mt-2 text-2xl font-semibold text-white">{overall.readiness}</div>
            <p className="mt-2 text-sm text-zinc-400">Overall state projected from database, config, auth, deploy, and SDK checks.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-zinc-400">Live verification</div>
            <div className="mt-2 text-2xl font-semibold text-white">{overall.fullyVerified ? 'Attached' : 'Pending'}</div>
            <p className="mt-2 text-sm text-zinc-400">A setup page can be healthy without live proof. Proof becomes attached after a successful validation flow.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-zinc-400">Proof artifact</div>
            <div className="mt-2 text-2xl font-semibold text-white">Ready</div>
            <p className="mt-2 text-sm text-zinc-400">Use <code>/api/setup/status</code> for machine checks and this page for operator truth.</p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            {view.sections.map((section) => (
              <article key={section.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-white">{section.title}</h2>
                    <p className="mt-1 text-sm text-zinc-300">{section.summary}</p>
                  </div>
                  <span className={`text-xs font-semibold uppercase tracking-wide ${checkTone(section.status)}`}>
                    {section.status}
                  </span>
                </div>
                {section.whatWasChecked ? (
                  <p className="mt-3 text-xs text-zinc-500">Checked: {section.whatWasChecked}</p>
                ) : null}
                <div className="mt-4">
                  <CheckList checks={section.checks} />
                </div>
              </article>
            ))}
          </div>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-semibold text-white">Workflow</h2>
              <div className="mt-4 space-y-3">
                {view.workflow.map((step) => (
                  <div key={step.id} className="rounded-xl border border-white/10 bg-zinc-950/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium text-white">{step.title}</div>
                      <div className={`text-xs font-semibold uppercase tracking-wide ${checkTone(step.status)}`}>{step.status}</div>
                    </div>
                    <p className="mt-2 text-sm text-zinc-300">{step.summary}</p>
                    {step.nextAction ? <p className="mt-2 text-xs text-zinc-500">Next: {step.nextAction}</p> : null}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-semibold text-white">Recommended next steps</h2>
              <div className="mt-4">
                <RecommendationList recommendations={view.recommendations} />
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
