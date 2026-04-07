/**
 * Variable substitution engine for workflow step configs.
 *
 * Resolves patterns like:
 *   ${variables.query}
 *   ${steps.step_1.output.answer}
 *   ${steps.step_1.output.chunks[0].content}
 */

function resolvePath(obj, path) {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}

function resolveString(str, context) {
  // Check if entire string is a single variable — return original type
  const singleVarMatch = str.match(/^\$\{([^}]+)\}$/);
  if (singleVarMatch) {
    const resolved = resolvePath(context, singleVarMatch[1]);
    return resolved !== undefined ? resolved : str;
  }

  // Mixed string — replace all ${...} with string values
  return str.replace(/\$\{([^}]+)\}/g, (match, varPath) => {
    const resolved = resolvePath(context, varPath);
    return resolved !== undefined ? String(resolved) : match;
  });
}

export function resolveVars(value, context) {
  if (typeof value === 'string') {
    return resolveString(value, context);
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveVars(item, context));
  }
  if (value && typeof value === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = resolveVars(v, context);
    }
    return result;
  }
  return value;
}
