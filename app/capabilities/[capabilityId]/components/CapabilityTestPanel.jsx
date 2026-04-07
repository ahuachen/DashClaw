import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';

export default function CapabilityTestPanel({
  isSubmitting,
  result,
  onSubmit,
}) {
  const [payloadText, setPayloadText] = useState('{}');
  const [declaredGoal, setDeclaredGoal] = useState('');

  const validationError = useMemo(() => {
    try {
      JSON.parse(payloadText || '{}');
      return null;
    } catch {
      return 'Payload must be valid JSON';
    }
  }, [payloadText]);

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmedPayload = payloadText.trim();
    const trimmedDeclaredGoal = declaredGoal.trim();

    let parsedPayload;
    try {
      parsedPayload = JSON.parse(trimmedPayload || '{}');
    } catch {
      onSubmit({ error: 'Payload must be valid JSON' });
      return;
    }

    onSubmit({
      payload: parsedPayload,
      payloadText: trimmedPayload,
      declaredGoal: trimmedDeclaredGoal,
    });
  }

  return (
    <Card hover={false}>
      <CardHeader title="Test Panel" />
      <CardContent className="space-y-4">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1 text-sm text-zinc-400">
            <span>Declared goal</span>
            <input
              name="declared_goal"
              type="text"
              value={declaredGoal}
              onChange={(event) => setDeclaredGoal(event.target.value)}
              placeholder="Optional goal for this validation run"
              className="rounded-lg border border-white/10 bg-surface-tertiary px-3 py-2 text-sm text-white"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-zinc-400">
            <span>Test payload</span>
            <textarea
              aria-label="Test payload"
              name="payload"
              rows={8}
              value={payloadText}
              onChange={(event) => setPayloadText(event.target.value)}
              className="rounded-lg border border-white/10 bg-surface-tertiary px-3 py-2 font-mono text-sm text-white"
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting || Boolean(validationError)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm text-white transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Running...' : 'Submit Test'}
          </button>
        </form>

        {validationError ? (
          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-200">
            {validationError}
          </div>
        ) : null}

        {result?.error ? (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {result.error}
          </div>
        ) : null}

        {result?.message ? (
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200">
            {result.message}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
