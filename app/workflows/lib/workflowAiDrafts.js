import { createDefaultWorkflowDraft } from './workflowDraftFormModel.js';
import { sanitizeExecutableSteps } from './workflowStepFormModel.js';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => normalizeString(entry)).filter(Boolean);
}

function indexOptions(options = []) {
  const byValue = new Map();
  const byLabel = new Map();

  for (const option of options) {
    if (!option?.value) continue;
    byValue.set(String(option.value), option);
    byLabel.set(String(option.label || '').trim().toLowerCase(), option);
  }

  return { byValue, byLabel };
}

function resolveOptionValue(candidate, options = []) {
  const normalized = typeof candidate === 'object' && candidate !== null
    ? candidate.value || candidate.id || candidate.name || candidate.label
    : candidate;
  const value = normalizeString(normalized);
  if (!value) return null;

  const index = indexOptions(options);
  if (index.byValue.has(value)) return value;
  if (/^(mst|gp|kn|cap|pt)_[a-z0-9_-]+$/i.test(value)) return value;

  const byLabelMatch = index.byLabel.get(value.toLowerCase());
  return byLabelMatch?.value || null;
}

function resolveMany(candidates, options, notes, label) {
  const resolved = [];
  const seen = new Set();

  for (const candidate of normalizeStringArray(candidates)) {
    const value = resolveOptionValue(candidate, options);
    if (!value) {
      notes.push(`${label} suggestion "${candidate}" could not be matched to an existing DashClaw resource.`);
      continue;
    }
    if (seen.has(value)) continue;
    seen.add(value);
    resolved.push(value);
  }

  return resolved;
}

function inferStepType(step = {}) {
  const explicit = normalizeString(step.type).toLowerCase();
  if (['knowledge_search', 'capability_invoke', 'prompt'].includes(explicit)) return explicit;
  if (explicit.includes('knowledge') || explicit.includes('search')) return 'knowledge_search';
  if (explicit.includes('capability') || explicit.includes('tool') || explicit.includes('action')) return 'capability_invoke';
  if (explicit.includes('prompt') || explicit.includes('llm') || explicit.includes('summar')) return 'prompt';
  if (step.collection || step.collection_id || step.query) return 'knowledge_search';
  if (step.capability || step.capability_id || step.payload || step.body) return 'capability_invoke';
  if (step.prompt || step.prompt_template || step.system_prompt) return 'prompt';
  return null;
}

function normalizePromptStep(step, resourceOptions, notes, index) {
  const promptTemplateId = resolveOptionValue(
    step.prompt_template_id || step.prompt_template_name || step.prompt_template_ref,
    resourceOptions.promptTemplates || []
  );
  const promptTemplateOption = (resourceOptions.promptTemplates || []).find((option) => option.value === promptTemplateId);

  const promptTemplate = normalizeString(
    step.prompt_template
    || step.prompt
    || promptTemplateOption?.content
    || ''
  );

  if (!promptTemplate) {
    notes.push(`Prompt step ${index + 1} did not include prompt content, so the prompt body was left blank for review.`);
  }

  return {
    id: `step_${index + 1}`,
    type: 'prompt',
    name: normalizeString(step.name) || `Prompt ${index + 1}`,
    config: {
      prompt_template: promptTemplate,
      system_prompt: normalizeString(step.system_prompt),
      max_tokens: Number.isFinite(Number(step.max_tokens)) ? Number(step.max_tokens) : 1024,
      temperature: Number.isFinite(Number(step.temperature)) ? Number(step.temperature) : 0.3,
    },
  };
}

function normalizeStep(step, index, resourceOptions, notes) {
  const type = inferStepType(step);
  if (!type) {
    notes.push(`AI suggested unsupported workflow step "${step?.type || step?.name || `step ${index + 1}`}", so it was omitted from the draft.`);
    return null;
  }

  if (type === 'knowledge_search') {
    const collectionId = resolveOptionValue(
      step.collection_id || step.collection || step.knowledge_collection,
      resourceOptions.knowledgeCollections || []
    );

    if ((step.collection_id || step.collection || step.knowledge_collection) && !collectionId) {
      notes.push(`Knowledge step ${index + 1} could not match its collection to an existing knowledge collection.`);
    }

    return {
      id: `step_${index + 1}`,
      type: 'knowledge_search',
      name: normalizeString(step.name) || `Knowledge search ${index + 1}`,
      config: {
        collection_id: collectionId || '',
        query: normalizeString(step.query || step.search_query || step.prompt),
        top_k: Number.isFinite(Number(step.top_k)) ? Number(step.top_k) : 5,
      },
    };
  }

  if (type === 'capability_invoke') {
    const capabilityId = resolveOptionValue(
      step.capability_id || step.capability || step.tool || step.action,
      resourceOptions.capabilities || []
    );

    if ((step.capability_id || step.capability || step.tool || step.action) && !capabilityId) {
      notes.push(`Capability step ${index + 1} could not match its capability to an existing DashClaw capability.`);
    }

    const payload = step.body && typeof step.body === 'object' && !Array.isArray(step.body)
      ? step.body
      : (step.payload && typeof step.payload === 'object' && !Array.isArray(step.payload) ? step.payload : {});

    return {
      id: `step_${index + 1}`,
      type: 'capability_invoke',
      name: normalizeString(step.name) || `Capability invoke ${index + 1}`,
      config: {
        capability_id: capabilityId || '',
        body: payload,
      },
    };
  }

  return normalizePromptStep(step, resourceOptions, notes, index);
}

function buildPromptTemplateSuggestions(rawDraft) {
  const linked = rawDraft?.linked_resources?.prompt_templates;
  const explicit = rawDraft?.linked_prompt_template_ids;
  return [...normalizeStringArray(linked), ...normalizeStringArray(explicit)];
}

export function normalizeGeneratedWorkflowDraft(rawDraft = {}, resourceOptions = {}) {
  const notes = [];
  const linkedResources = rawDraft.linked_resources && typeof rawDraft.linked_resources === 'object'
    ? rawDraft.linked_resources
    : {};

  const normalizedSteps = sanitizeExecutableSteps(
    (Array.isArray(rawDraft.steps) ? rawDraft.steps : [])
      .map((step, index) => normalizeStep(step, index, resourceOptions, notes))
      .filter(Boolean)
  );

  const draft = createDefaultWorkflowDraft({
    name: rawDraft.name,
    slug: rawDraft.slug,
    description: rawDraft.description,
    objective: rawDraft.objective,
    status: rawDraft.status || 'draft',
    model_strategy_id: resolveOptionValue(
      linkedResources.model_strategy || rawDraft.model_strategy_id,
      resourceOptions.modelStrategies || []
    ) || '',
    linked_policy_ids: resolveMany(
      linkedResources.policies || rawDraft.linked_policy_ids,
      resourceOptions.policies || [],
      notes,
      'Policy'
    ),
    linked_knowledge_collection_ids: resolveMany(
      linkedResources.knowledge_collections || rawDraft.linked_knowledge_collection_ids,
      resourceOptions.knowledgeCollections || [],
      notes,
      'Knowledge collection'
    ),
    linked_capability_ids: resolveMany(
      linkedResources.capabilities || rawDraft.linked_capability_ids,
      resourceOptions.capabilities || [],
      notes,
      'Capability'
    ),
    linked_prompt_template_ids: resolveMany(
      buildPromptTemplateSuggestions(rawDraft),
      resourceOptions.promptTemplates || [],
      notes,
      'Prompt template'
    ),
    linked_capability_tags: normalizeStringArray(
      linkedResources.capability_tags || rawDraft.linked_capability_tags
    ),
    steps: normalizedSteps,
  });

  if (!draft.name) {
    notes.push('AI did not produce a workflow name, so the draft still needs a name before you can save it.');
  }

  if (normalizeStringArray(rawDraft.notes).length > 0) {
    notes.push(...normalizeStringArray(rawDraft.notes));
  }

  return {
    draft,
    notes,
    rawDraft,
  };
}
