import { CodeBlock } from './Common';

export function RecommendedSteps({ recommendations }) {
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
