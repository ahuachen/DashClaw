import { invokeCapability, resolveAuth } from './capability-invoke.js';
import { assertPayloadMatchesSchema, validateInvocationSchema } from './capability-contracts.js';
import { resolveEndpointUrl } from './mapping.js';
import { getCapability } from './repositories/capabilities.repository.js';
import { getSettings } from './repositories/settings.repository.js';

async function loadOrgSettings(sql, orgId) {
  const orgSettings = {};

  try {
    const rows = await getSettings(sql, orgId);
    for (const row of rows) {
      orgSettings[row.key] = row.value;
    }
  } catch {
    // Settings table may not exist yet in some deployments.
  }

  return orgSettings;
}

export async function prepareCapabilityInvocation(sql, orgId, capabilityId) {
  const capability = await getCapability(sql, orgId, capabilityId);
  if (!capability) {
    throw new Error(`Capability not found: ${capabilityId}`);
  }

  if (capability.source_type !== 'http_api') {
    throw new Error(`Capability ${capabilityId} is not an http_api type`);
  }

  const schema = capability.invocation_schema || {};
  validateInvocationSchema(capability.source_type, schema);
  const orgSettings = await loadOrgSettings(sql, orgId);
  const authHeaders = resolveAuth(schema.auth, orgSettings);
  const endpoint = resolveEndpointUrl(schema.endpoint, orgSettings);

  return {
    capability,
    schema,
    authHeaders,
    endpoint,
  };
}

export async function executeCapabilityInvocation({
  endpoint,
  authHeaders,
  schema,
  body,
}) {
  try {
    assertPayloadMatchesSchema(body, schema.input_schema, 'input');
  } catch (err) {
    return {
      success: false,
      error: err.code || 'capability_input_invalid',
      message: err.message,
    };
  }

  const result = await invokeCapability({
    endpoint,
    method: schema.method || 'POST',
    authHeaders,
    body,
    requestMapping: schema.request_mapping,
    responseMapping: schema.response_mapping,
    timeoutMs: schema.timeout_ms || 60000,
    retryPolicy: schema.retry_policy,
  });

  if (!result.success) {
    return result;
  }

  try {
    assertPayloadMatchesSchema(result.data, schema.output_schema, 'output');
  } catch (err) {
    return {
      success: false,
      error: err.code || 'capability_output_invalid',
      message: err.message,
      elapsed_ms: result.elapsed_ms,
    };
  }

  return result;
}
