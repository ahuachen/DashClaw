import { getTranslations, getLocale } from 'next-intl/server';
import { projectReadinessReport, getReadinessReport } from '../lib/readiness.mjs';

function statusTone(status) {
  switch (status) {
    case 'verified':
      return 'border-success/40 bg-success-subtle text-emerald-200';
    case 'ready_unverified':
      return 'border-sky-500/40 bg-sky-500/10 text-sky-200';
    case 'needs_attention':
      return 'border-warning/40 bg-warning-subtle text-amber-200';
    default:
      return 'border-error/40 bg-error-subtle text-red-200';
  }
}

function checkTone(status) {
  switch (status) {
    case 'pass':
      return 'text-success';
    case 'warn':
    case 'pending':
      return 'text-warning';
    case 'info':
    case 'skipped':
      return 'text-secondary';
    default:
      return 'text-error';
  }
}

function CheckList({ checks = [], nextLabel }) {
  if (!checks.length) return null;

  return (
    <ul className="space-y-3">
      {checks.map((check) => (
        <li key={check.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-white">{check.label}</div>
              <div className="mt-1 text-sm text-secondary">{check.detail}</div>
              {check.subDetail ? (
                <div className="mt-2 text-xs text-secondary">{check.subDetail}</div>
              ) : null}
              {check.nextAction ? (
                <div className="mt-2 text-xs text-secondary">{nextLabel}{check.nextAction}</div>
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
          <p className="mt-2 text-sm text-secondary">{step.summary}</p>
          {Array.isArray(step.details) && step.details.length > 0 ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-secondary">
              {step.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}
          {step.code ? (
            <pre className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-primary/80 p-3 text-xs text-secondary">
              <code>{step.code}</code>
            </pre>
          ) : null}
          {step.note ? <p className="mt-2 text-xs text-tertiary">{step.note}</p> : null}
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
  const t = await getTranslations('setup');
  const locale = await getLocale();
  const dateLocale = locale === 'zh-CN' ? 'zh-CN' : 'en-US';
  const checkedNext = t('sections.nextPrefix').replace('{action}', '');

  return (
    <main className="min-h-screen bg-primary px-6 py-10 text-primary">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
              {t('badge')}
            </span>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${statusTone(overall.overall)}`}>
              {overall.label}
            </span>
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold text-white">{t('h1')}</h1>
            <p className="max-w-3xl text-base text-secondary">{overall.summary}</p>
            <p className="text-sm text-tertiary">
              {t('checkedAt', { time: new Date(view.checkedAt).toLocaleString(dateLocale, { dateStyle: 'medium', timeStyle: 'short' }) })}
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-secondary">{t('kpis.readiness')}</div>
            <div className="mt-2 text-2xl font-semibold text-white">{overall.readiness}</div>
            <p className="mt-2 text-sm text-secondary">{t('kpis.readinessNote')}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-secondary">{t('kpis.liveVerification')}</div>
            <div className="mt-2 text-2xl font-semibold text-white">{overall.fullyVerified ? t('kpis.liveAttached') : t('kpis.livePending')}</div>
            <p className="mt-2 text-sm text-secondary">{t('kpis.liveNote')}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-secondary">{t('kpis.proof')}</div>
            <div className="mt-2 text-2xl font-semibold text-white">{t('kpis.proofValue')}</div>
            <p
              className="mt-2 text-sm text-secondary"
              dangerouslySetInnerHTML={{ __html: t.raw('kpis.proofNote') }}
            />
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            {view.sections.map((section) => (
              <article key={section.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-white">{section.title}</h2>
                    <p className="mt-1 text-sm text-secondary">{section.summary}</p>
                  </div>
                  <span className={`text-xs font-semibold uppercase tracking-wide ${checkTone(section.status)}`}>
                    {section.status}
                  </span>
                </div>
                {section.whatWasChecked ? (
                  <p className="mt-3 text-xs text-tertiary">{t('sections.checkedPrefix', { what: section.whatWasChecked })}</p>
                ) : null}
                <div className="mt-4">
                  <CheckList checks={section.checks} nextLabel={checkedNext} />
                </div>
              </article>
            ))}
          </div>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-semibold text-white">{t('sidebar.workflow')}</h2>
              <div className="mt-4 space-y-3">
                {view.workflow.map((step) => (
                  <div key={step.id} className="rounded-xl border border-white/10 bg-primary/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium text-white">{step.title}</div>
                      <div className={`text-xs font-semibold uppercase tracking-wide ${checkTone(step.status)}`}>{step.status}</div>
                    </div>
                    <p className="mt-2 text-sm text-secondary">{step.summary}</p>
                    {step.nextAction ? <p className="mt-2 text-xs text-tertiary">{t('sections.nextPrefix', { action: step.nextAction })}</p> : null}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-semibold text-white">{t('sidebar.recommendedNext')}</h2>
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
