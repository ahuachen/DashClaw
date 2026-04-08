'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Copy, MoveDown, MoveUp, Trash2 } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { buildWorkflowStepSummary, WORKFLOW_STEP_TYPES } from '../lib/workflowStepFormModel.js';

const inputClass = 'w-full px-3 py-2 bg-surface-tertiary border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-brand';
const labelClass = 'block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5';

function bodyObjectToRows(body) {
  return Object.entries(body || {}).map(([key, value]) => ({
    key,
    value: typeof value === 'string' ? value : JSON.stringify(value),
  }));
}

function bodyRowsToObject(rows) {
  return rows.reduce((acc, row) => {
    if (!row.key?.trim()) return acc;
    acc[row.key.trim()] = row.value ?? '';
    return acc;
  }, {});
}

function titleForType(type) {
  return WORKFLOW_STEP_TYPES.find((item) => item.value === type)?.label || type;
}

function makeFieldId(stepId, fieldName) {
  return `${stepId}-${fieldName}`;
}

export default function WorkflowStepCard({
  step,
  index,
  total,
  onChange,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [bodyRows, setBodyRows] = useState(() => bodyObjectToRows(step.config?.body));
  const stepNameId = makeFieldId(step.id, 'name');
  const collectionId = makeFieldId(step.id, 'collection-id');
  const topResultsId = makeFieldId(step.id, 'top-results');
  const searchQueryId = makeFieldId(step.id, 'search-query');
  const capabilityId = makeFieldId(step.id, 'capability-id');
  const promptTemplateId = makeFieldId(step.id, 'prompt-template');
  const systemPromptId = makeFieldId(step.id, 'system-prompt');
  const maxTokensId = makeFieldId(step.id, 'max-tokens');
  const temperatureId = makeFieldId(step.id, 'temperature');

  const summary = useMemo(() => buildWorkflowStepSummary(step), [step]);

  function updateStep(patch) {
    onChange({
      ...step,
      ...patch,
    });
  }

  function updateConfig(configPatch) {
    updateStep({
      config: {
        ...step.config,
        ...configPatch,
      },
    });
  }

  function updateBodyRow(nextRows) {
    setBodyRows(nextRows);
    updateConfig({ body: bodyRowsToObject(nextRows) });
  }

  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]">
      <div className="flex items-start justify-between gap-3 px-4 py-4 border-b border-[rgba(255,255,255,0.06)]">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="info" size="xs">Step {index + 1}</Badge>
            <Badge variant="success" size="xs">{titleForType(step.type)}</Badge>
          </div>
          <div className="mt-2 text-sm font-medium text-white">{step.name}</div>
          <p className="mt-1 text-xs text-zinc-400">{summary}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button type="button" onClick={() => setCollapsed((value) => !value)} className="p-2 text-zinc-500 hover:text-white transition-colors" aria-label={collapsed ? 'Expand step' : 'Collapse step'}>
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          <button type="button" onClick={onMoveUp} disabled={index === 0} className="p-2 text-zinc-500 hover:text-white transition-colors disabled:opacity-30" aria-label="Move step up">
            <MoveUp size={14} />
          </button>
          <button type="button" onClick={onMoveDown} disabled={index === total - 1} className="p-2 text-zinc-500 hover:text-white transition-colors disabled:opacity-30" aria-label="Move step down">
            <MoveDown size={14} />
          </button>
          <button type="button" onClick={onDuplicate} className="p-2 text-zinc-500 hover:text-white transition-colors" aria-label="Duplicate step">
            <Copy size={14} />
          </button>
          <button type="button" onClick={onDelete} className="p-2 text-zinc-500 hover:text-red-400 transition-colors" aria-label="Delete step">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-4 space-y-4">
          <div>
            <label htmlFor={stepNameId} className={labelClass}>Step name</label>
            <input
              id={stepNameId}
              type="text"
              value={step.name}
              onChange={(event) => updateStep({ name: event.target.value })}
              className={inputClass}
            />
          </div>

          {step.type === 'knowledge_search' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={collectionId} className={labelClass}>Knowledge collection</label>
                <input
                  id={collectionId}
                  type="text"
                  value={step.config.collection_id}
                  onChange={(event) => updateConfig({ collection_id: event.target.value })}
                  className={inputClass}
                  placeholder="kn_customer_faq"
                />
              </div>
              <div>
                <label htmlFor={topResultsId} className={labelClass}>Top results</label>
                <input
                  id={topResultsId}
                  type="number"
                  min="1"
                  value={step.config.top_k}
                  onChange={(event) => updateConfig({ top_k: Number(event.target.value) || 1 })}
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor={searchQueryId} className={labelClass}>Search query</label>
                <input
                  id={searchQueryId}
                  type="text"
                  value={step.config.query}
                  onChange={(event) => updateConfig({ query: event.target.value })}
                  className={inputClass}
                  placeholder="refund eligibility"
                />
              </div>
            </div>
          )}

          {step.type === 'capability_invoke' && (
            <div className="space-y-4">
              <div>
                <label htmlFor={capabilityId} className={labelClass}>Capability</label>
                <input
                  id={capabilityId}
                  type="text"
                  value={step.config.capability_id}
                  onChange={(event) => updateConfig({ capability_id: event.target.value })}
                  className={inputClass}
                  placeholder="cap_slack_notify"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelClass}>Payload fields</label>
                  <button
                    type="button"
                    onClick={() => updateBodyRow([...bodyRows, { key: '', value: '' }])}
                    className="px-2.5 py-1 rounded-lg bg-white/5 text-xs text-zinc-300 hover:bg-white/10 transition-colors"
                  >
                    Add payload field
                  </button>
                </div>
                <div className="space-y-2">
                  {bodyRows.length === 0 ? (
                    <p className="text-xs text-zinc-500">No payload fields yet. Add key/value fields for the capability request body.</p>
                  ) : bodyRows.map((row, rowIndex) => (
                    <div key={`${step.id}-payload-${rowIndex}`} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                      <input
                        type="text"
                        value={row.key}
                        onChange={(event) => {
                          const nextRows = [...bodyRows];
                          nextRows[rowIndex] = { ...row, key: event.target.value };
                          updateBodyRow(nextRows);
                        }}
                        className={inputClass}
                        placeholder="field name"
                      />
                      <input
                        type="text"
                        value={row.value}
                        onChange={(event) => {
                          const nextRows = [...bodyRows];
                          nextRows[rowIndex] = { ...row, value: event.target.value };
                          updateBodyRow(nextRows);
                        }}
                        className={inputClass}
                        placeholder="field value"
                      />
                      <button
                        type="button"
                        onClick={() => updateBodyRow(bodyRows.filter((_, candidateIndex) => candidateIndex !== rowIndex))}
                        className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step.type === 'prompt' && (
            <div className="space-y-4">
              <div>
                <label htmlFor={promptTemplateId} className={labelClass}>Prompt template</label>
                <textarea
                  id={promptTemplateId}
                  value={step.config.prompt_template}
                  onChange={(event) => updateConfig({ prompt_template: event.target.value })}
                  rows={4}
                  className={inputClass}
                  placeholder="Summarize the knowledge search results for the customer."
                />
              </div>
              <div>
                <label htmlFor={systemPromptId} className={labelClass}>System prompt</label>
                <textarea
                  id={systemPromptId}
                  value={step.config.system_prompt}
                  onChange={(event) => updateConfig({ system_prompt: event.target.value })}
                  rows={3}
                  className={inputClass}
                  placeholder="Optional system instruction"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor={maxTokensId} className={labelClass}>Max tokens</label>
                  <input
                    id={maxTokensId}
                    type="number"
                    min="1"
                    value={step.config.max_tokens}
                    onChange={(event) => updateConfig({ max_tokens: Number(event.target.value) || 1 })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor={temperatureId} className={labelClass}>Temperature</label>
                  <input
                    id={temperatureId}
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={step.config.temperature}
                    onChange={(event) => updateConfig({ temperature: Number(event.target.value) || 0 })}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
