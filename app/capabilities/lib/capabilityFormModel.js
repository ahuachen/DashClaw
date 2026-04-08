function cleanString(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function buildInputSchema(inputFields = []) {
  const properties = {};
  const required = [];

  for (const field of inputFields) {
    const key = cleanString(field.key);
    const type = cleanString(field.type) || 'string';
    if (!key) continue;

    properties[key] = { type };

    const label = cleanString(field.label);
    const helpText = cleanString(field.helpText);

    if (label) {
      properties[key].title = label;
    }
    if (helpText) {
      properties[key].description = helpText;
    }
    if (field.required) {
      required.push(key);
    }
  }

  return {
    type: 'object',
    ...(required.length > 0 ? { required } : {}),
    properties,
  };
}

export function compileCapabilityPayload(formState) {
  const metadata = formState?.metadata || {};
  const payload = {
    name: cleanString(metadata.name),
    description: cleanString(metadata.description),
    category: cleanString(metadata.category),
    source_type: metadata.source_type || 'internal_sdk',
    auth_type: cleanString(metadata.auth_type) || 'none',
    risk_level: metadata.risk_level || 'medium',
    requires_approval: Boolean(metadata.requires_approval),
    tags: Array.isArray(metadata.tags) ? metadata.tags.filter(Boolean) : [],
    docs_url: cleanString(metadata.docs_url),
    health_status: metadata.health_status || 'unknown',
  };

  if (formState?.mode !== 'runnable_http') {
    return payload;
  }

  const runtime = formState?.runtime || {};
  payload.source_type = 'http_api';
  payload.auth_type = runtime?.auth?.type || payload.auth_type;
  payload.invocation_schema = {
    endpoint: cleanString(runtime.endpoint),
    method: runtime.method || 'POST',
    timeout_ms: runtime.timeout_ms,
    auth: runtime.auth || { type: 'none' },
    input_schema: buildInputSchema(runtime.inputFields),
  };

  if (runtime.retry_policy && runtime.retry_policy.max_retries > 0) {
    payload.invocation_schema.retry_policy = {
      max_retries: runtime.retry_policy.max_retries,
      backoff: runtime.retry_policy.backoff || 'none',
      base_delay_ms: runtime.retry_policy.base_delay_ms || 1000,
      max_delay_ms: runtime.retry_policy.max_delay_ms || 30000,
      ...(runtime.retry_policy.retryable_status_codes
        ? { retryable_status_codes: runtime.retry_policy.retryable_status_codes }
        : {}),
    };
  }

  if (runtime.circuit_breaker && runtime.circuit_breaker.enabled) {
    payload.invocation_schema.circuit_breaker = {
      enabled: true,
      consecutive_failures: runtime.circuit_breaker.consecutive_failures || 5,
    };
  }

  return payload;
}

export function deriveGeneratedInputFields(capability) {
  const inputSchema = capability?.invocation_schema?.input_schema;
  if (!inputSchema || inputSchema.type !== 'object' || !inputSchema.properties) {
    return [];
  }

  const required = new Set(Array.isArray(inputSchema.required) ? inputSchema.required : []);

  return Object.entries(inputSchema.properties).map(([key, schema]) => ({
    key,
    label: schema?.title || key,
    type: schema?.type || 'string',
    required: required.has(key),
    helpText: schema?.description || '',
  }));
}

export function isRunnableHttpCapability(capability) {
  return (
    capability?.source_type === 'http_api' &&
    typeof capability?.invocation_schema?.endpoint === 'string' &&
    capability.invocation_schema.endpoint.trim().length > 0
  );
}

export function deriveCapabilityMode(capability) {
  return isRunnableHttpCapability(capability) ? 'runnable_http' : 'registry_only';
}

