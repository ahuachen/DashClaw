import { ActionLink, CodeBlock } from './Common';

export function ConnectNextStepPanel({ step }) {
  const isConnected = step.state === 'connected';
  const borderClass = isConnected ? 'border-emerald-900/40' : 'border-brand/35';
  const accentClass = isConnected ? 'text-emerald-300' : 'text-brand';

  return (
    <div className={`mt-6 rounded-2xl border bg-[#111] p-6 ${borderClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className={`text-xs uppercase tracking-[0.3em] ${accentClass}`}>Next move</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">{step.title}</h2>
          <p className="mt-2 text-sm text-zinc-300">{step.summary}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <ActionLink href={step.primaryCta.href}>{step.primaryCta.label}</ActionLink>
          {step.secondaryCtas.map((cta) => (
            <ActionLink key={`${step.state}-${cta.href}`} href={cta.href} secondary>
              {cta.label}
            </ActionLink>
          ))}
        </div>
      </div>

      {step.statusItems.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {step.statusItems.map((item) => (
            <span
              key={item.label}
              className={`rounded-full border px-3 py-1 text-xs ${
                item.complete
                  ? 'border-emerald-900/40 bg-emerald-900/10 text-emerald-300'
                  : 'border-[rgba(255,255,255,0.08)] bg-[#0d0d0d] text-zinc-400'
              }`}
            >
              {item.label}
            </span>
          ))}
        </div>
      ) : null}

      {step.state === 'connect_agent' ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <ConnectSnippetCard
            id="connect-node"
            label="Node starter"
            description="Install the SDK and send one real action."
            code={step.snippets.node}
          />
          <ConnectSnippetCard
            id="connect-python"
            label="Python starter"
            description="Use the Python SDK to send the same first action."
            code={step.snippets.python}
          />
          <ConnectSnippetCard
            id="connect-validator"
            label="Validator"
            description="Capture live verification proof after auth succeeds."
            code={step.validatorCommand}
          />
        </div>
      ) : null}
    </div>
  );
}

function ConnectSnippetCard({ id, label, description, code }) {
  return (
    <div id={id} className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0d0d0d] p-4">
      <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">{label}</p>
      <p className="mt-2 text-xs text-zinc-400">{description}</p>
      <CodeBlock>{code}</CodeBlock>
    </div>
  );
}
