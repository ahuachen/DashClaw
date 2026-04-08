import { sanitizeExecutableSteps } from './workflowStepFormModel.js';

const DEFAULT_DRAFT = {
  name: '',
  slug: '',
  description: '',
  objective: '',
  status: 'draft',
  model_strategy_id: '',
  linked_policy_ids: [],
  linked_knowledge_collection_ids: [],
  linked_capability_ids: [],
  linked_prompt_template_ids: [],
  linked_capability_tags: [],
  steps: [],
};

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStatus(value) {
  return ['draft', 'active', 'archived'].includes(value) ? value : 'draft';
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((entry) => normalizeString(entry)).filter(Boolean))];
}

export function createDefaultWorkflowDraft(overrides = {}) {
  return {
    ...DEFAULT_DRAFT,
    ...overrides,
    name: normalizeString(overrides.name ?? DEFAULT_DRAFT.name),
    slug: normalizeString(overrides.slug ?? DEFAULT_DRAFT.slug),
    description: typeof overrides.description === 'string' ? overrides.description : DEFAULT_DRAFT.description,
    objective: typeof overrides.objective === 'string' ? overrides.objective : DEFAULT_DRAFT.objective,
    status: normalizeStatus(overrides.status ?? DEFAULT_DRAFT.status),
    model_strategy_id: normalizeString(overrides.model_strategy_id ?? DEFAULT_DRAFT.model_strategy_id),
    linked_policy_ids: normalizeStringArray(overrides.linked_policy_ids ?? DEFAULT_DRAFT.linked_policy_ids),
    linked_knowledge_collection_ids: normalizeStringArray(overrides.linked_knowledge_collection_ids ?? DEFAULT_DRAFT.linked_knowledge_collection_ids),
    linked_capability_ids: normalizeStringArray(overrides.linked_capability_ids ?? DEFAULT_DRAFT.linked_capability_ids),
    linked_prompt_template_ids: normalizeStringArray(overrides.linked_prompt_template_ids ?? DEFAULT_DRAFT.linked_prompt_template_ids),
    linked_capability_tags: normalizeStringArray(overrides.linked_capability_tags ?? DEFAULT_DRAFT.linked_capability_tags),
    steps: sanitizeExecutableSteps(overrides.steps ?? DEFAULT_DRAFT.steps),
  };
}

export function decompileWorkflowTemplateToDraft(template = {}) {
  return createDefaultWorkflowDraft({
    name: template.name,
    slug: template.slug,
    description: template.description,
    objective: template.objective,
    status: template.status,
    model_strategy_id: template.model_strategy_id,
    linked_policy_ids: template.linked_policy_ids,
    linked_knowledge_collection_ids: template.linked_knowledge_collection_ids,
    linked_capability_ids: template.linked_capability_ids,
    linked_prompt_template_ids: template.linked_prompt_template_ids,
    linked_capability_tags: template.linked_capability_tags,
    steps: template.steps,
  });
}

export function compileWorkflowDraftPayload(draft = {}) {
  const normalized = createDefaultWorkflowDraft(draft);

  return {
    name: normalized.name,
    slug: normalized.slug || undefined,
    description: normalized.description.trim() || undefined,
    objective: normalized.objective.trim() || undefined,
    status: normalized.status,
    model_strategy_id: normalized.model_strategy_id || undefined,
    linked_policy_ids: normalized.linked_policy_ids,
    linked_knowledge_collection_ids: normalized.linked_knowledge_collection_ids,
    linked_capability_ids: normalized.linked_capability_ids,
    linked_prompt_template_ids: normalized.linked_prompt_template_ids,
    linked_capability_tags: normalized.linked_capability_tags,
    steps: sanitizeExecutableSteps(normalized.steps),
  };
}
