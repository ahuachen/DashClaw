/**
 * Dot-path request/response mapper for capability invocations.
 * Resolves $.field paths from a source object into a target shape.
 */

function resolvePath(source, path) {
  if (typeof path !== 'string' || !path.startsWith('$.')) return undefined;
  const key = path.slice(2);
  return source[key];
}

function mapObject(source, mapping) {
  if (!mapping || typeof mapping !== 'object') return null;
  const result = {};
  let hasKeys = false;

  for (const [key, value] of Object.entries(mapping)) {
    if (typeof value === 'string' && value.startsWith('$.')) {
      const resolved = resolvePath(source, value);
      if (resolved !== undefined) {
        result[key] = resolved;
        hasKeys = true;
      }
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = mapObject(source, value);
      if (nested !== null) {
        result[key] = nested;
        hasKeys = true;
      }
    } else {
      result[key] = value;
      hasKeys = true;
    }
  }

  return hasKeys ? result : null;
}

export function mapRequest(source, mapping) {
  if (!mapping || Object.keys(mapping).length === 0) return source;
  const mapped = mapObject(source, mapping);
  return mapped || source;
}

export function mapResponse(source, mapping) {
  if (!mapping || Object.keys(mapping).length === 0) return source;
  const mapped = mapObject(source, mapping);
  return mapped || source;
}

export function resolveEndpointUrl(url, settings) {
  return url.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    const value = settings[varName];
    if (value === undefined || value === null || value === '') {
      const err = new Error(`Setting '${varName}' not configured for capability endpoint`);
      err.code = 'endpoint_not_configured';
      throw err;
    }
    return value;
  });
}
