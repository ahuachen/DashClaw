export const WORKFLOW_STEP_TYPES = [
  {
    value: 'knowledge_search',
    label: 'Knowledge Search',
    description: 'Search a linked knowledge collection and return matching chunks.',
  },
  {
    value: 'capability_invoke',
    label: 'Capability Invoke',
    description: 'Call a linked DashClaw capability with a structured payload.',
  },
  {
    value: 'prompt',
    label: 'Prompt',
    description: 'Run a prompt step through the workflow model strategy.',
  },
];

const STEP_CONFIG_DEFAULTS = {
  knowledge_search: {
    collection_id: '',
    query: '',
    top_k: 5,
  },
  capability_invoke: {
    capability_id: '',
    body: {},
  },
  prompt: {
    prompt_template: '',
    system_prompt: '',
    max_tokens: 1024,
    temperature: 0.3,
  },
};

const STEP_NAME_PREFIX = {
  knowledge_search: 'Knowledge search',
  capability_invoke: 'Capability invoke',
  prompt: 'Prompt',
};

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeId(id, index) {
  return typeof id === 'string' && id.trim() ? id.trim() : `step_${index + 1}`;
}

function normalizeName(name, type, index) {
  if (typeof name === 'string' && name.trim()) return name.trim();
  return `${STEP_NAME_PREFIX[type] || 'Step'} ${index + 1}`;
}

function normalizeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const BACKOFF_STRATEGIES = new Set(['none', 'fixed', 'exponential']);

export function sanitizeRetryPolicy(policy) {
  if (!policy || typeof policy !== 'object') return undefined;
  const maxRetries = Number.isInteger(policy.max_retries) ? Math.max(0, Math.min(10, policy.max_retries)) : 0;
  if (maxRetries === 0) return undefined;
  return {
    max_retries: maxRetries,
    backoff: BACKOFF_STRATEGIES.has(policy.backoff) ? policy.backoff : 'none',
    base_delay_ms: Number.isInteger(policy.base_delay_ms) ? Math.max(100, Math.min(30000, policy.base_delay_ms)) : 1000,
    max_delay_ms: Number.isInteger(policy.max_delay_ms) ? Math.max(100, Math.min(60000, policy.max_delay_ms)) : 30000,
  };
}

function sanitizeStepConfig(type, config = {}) {
  switch (type) {
    case 'knowledge_search':
      return {
        collection_id: typeof config.collection_id === 'string' ? config.collection_id.trim() : '',
        query: typeof config.query === 'string' ? config.query : '',
        top_k: normalizeNumber(config.top_k, 5),
      };
    case 'capability_invoke':
      return {
        capability_id: typeof config.capability_id === 'string' ? config.capability_id.trim() : '',
        body: config.body && typeof config.body === 'object' && !Array.isArray(config.body) ? config.body : {},
      };
    case 'prompt':
      return {
        prompt_template: typeof config.prompt_template === 'string' ? config.prompt_template : '',
        system_prompt: typeof config.system_prompt === 'string' ? config.system_prompt : '',
        max_tokens: normalizeNumber(config.max_tokens, 1024),
        temperature: normalizeNumber(config.temperature, 0.3),
      };
    default:
      return {};
  }
}

export function createDefaultWorkflowStep(type, ordinal = 1) {
  return {
    id: `step_${ordinal}`,
    type,
    name: `${STEP_NAME_PREFIX[type] || 'Step'} ${ordinal}`,
    config: deepClone(STEP_CONFIG_DEFAULTS[type] || {}),
    condition: '',
    continue_on_failure: false,
  };
}

export function sanitizeExecutableSteps(steps) {
  if (!Array.isArray(steps)) return [];

  return steps
    .filter((step) => step && typeof step === 'object' && WORKFLOW_STEP_TYPES.some((item) => item.value === step.type))
    .map((step, index) => {
      const sanitized = {
        id: normalizeId(step.id, index),
        type: step.type,
        name: normalizeName(step.name, step.type, index),
        config: sanitizeStepConfig(step.type, step.config),
      };
      const retryPolicy = sanitizeRetryPolicy(step.retry_policy);
      if (retryPolicy) sanitized.retry_policy = retryPolicy;
      if (typeof step.condition === 'string' && step.condition.trim()) {
        sanitized.condition = step.condition.trim();
      }
      if (step.continue_on_failure === true) {
        sanitized.continue_on_failure = true;
      }
      return sanitized;
    });
}

export function buildWorkflowStepSummary(step) {
  let resourceLookups = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  if (!step || !step.type) return 'Unsupported workflow step';

  let base;
  switch (step.type) {
    case 'knowledge_search': {
      const collection = resourceLookups.knowledgeCollections?.[step.config?.collection_id]
        || step.config?.collection_id
        || 'a collection';
      const query = step.config?.query || 'a query';
      const topK = normalizeNumber(step.config?.top_k, 5);
      base = `Search ${collection} for "${query}" and return top ${topK} matches.`;
      break;
    }
    case 'capability_invoke': {
      const capability = resourceLookups.capabilities?.[step.config?.capability_id]
        || step.config?.capability_id
        || 'a capability';
      const bodyKeys = Object.keys(step.config?.body || {});
      if (bodyKeys.length === 0) {
        base = `Invoke ${capability} with an empty payload.`;
      } else {
        base = `Invoke ${capability} with ${bodyKeys.length} payload field${bodyKeys.length === 1 ? '' : 's'}.`;
      }
      break;
    }
    case 'prompt': {
      const prompt = step.config?.prompt_template || '';
      const preview = prompt.trim().slice(0, 60);
      base = preview
        ? `Run prompt using the linked model strategy: "${preview}${prompt.trim().length > 60 ? '...' : ''}".`
        : 'Run prompt using the linked model strategy.';
      break;
    }
    default:
      return 'Unsupported workflow step';
  }

  const suffixes = [];
  if (step.condition) suffixes.push(`Condition: ${step.condition}`);
  if (step.continue_on_failure) suffixes.push('Will continue on failure.');

  return suffixes.length > 0 ? `${base} ${suffixes.join(' ')}` : base;
}

export function insertVariableToken(currentValue, token) {
  if (!token) return currentValue || '';
  if (!currentValue) return token;

  const separator = String(currentValue).includes('\n') ? '\n' : ' ';
  return `${currentValue}${separator}${token}`;
}

export function buildWorkflowVariableGroups(steps, currentStepIndex) {
  const normalizedSteps = sanitizeExecutableSteps(steps);
  const previousSteps = normalizedSteps.slice(0, currentStepIndex);

  const previousStepOptions = previousSteps.flatMap((step) => {
    const generic = {
      label: `${step.name} output`,
      token: `\${steps.${step.id}.output}`,
    };

    if (step.type === 'knowledge_search') {
      return [
        generic,
        {
          label: `${step.name} top chunk`,
          token: `\${steps.${step.id}.output.chunks[0].content}`,
        },
        {
          label: `${step.name} query`,
          token: `\${steps.${step.id}.output.query}`,
        },
      ];
    }

    if (step.type === 'prompt') {
      return [
        generic,
        {
          label: `${step.name} text`,
          token: `\${steps.${step.id}.output.text}`,
        },
      ];
    }

    return [generic];
  });

  const groups = [
    {
      label: 'Workflow inputs',
      options: [
        {
          label: 'Workflow input variable',
          token: '${variables.input_name}',
        },
      ],
    },
  ];

  if (previousStepOptions.length > 0) {
    groups.push({
      label: 'Previous step outputs',
      options: previousStepOptions,
    });
  }

  return groups;
}

export function isLegacyWorkflowGraph(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  return Array.isArray(input.nodes) || Array.isArray(input.edges);
}

export function buildLegacyWorkflowFallback(input) {
  const nodes = Array.isArray(input?.nodes) ? input.nodes : [];
  const edges = Array.isArray(input?.edges) ? input.edges : [];
  const previewSteps = nodes.slice(0, 5).map((node, index) => {
    const label = node?.data?.label || node?.label || node?.id || `Legacy step ${index + 1}`;
    const type = node?.data?.stepType || node?.type || 'unknown';
    return `${label} (${type})`;
  });
  const nodeTypes = [...new Set(nodes.map((node) => node?.data?.stepType || node?.type || 'unknown'))];

  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodeTypes,
    previewSteps,
  };
}

export function normalizeWorkflowStepData(input) {
  if (isLegacyWorkflowGraph(input)) {
    return {
      mode: 'legacy',
      steps: [],
      legacyFallback: buildLegacyWorkflowFallback(input),
    };
  }

  return {
    mode: 'builder',
    steps: sanitizeExecutableSteps(input),
    legacyFallback: null,
  };
}
