import { invokeCapability, resolveAuth } from './capability-invoke.js';
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
  return invokeCapability({
    endpoint,
    method: schema.method || 'POST',
    authHeaders,
    body,
    requestMapping: schema.request_mapping,
    responseMapping: schema.response_mapping,
    timeoutMs: schema.timeout_ms || 60000,
  });
}
