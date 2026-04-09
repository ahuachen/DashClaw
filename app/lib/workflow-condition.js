/**
 * Workflow step condition evaluator.
 * Resolves a condition template against execution context and checks truthiness.
 * No dynamic code execution — uses the same resolveVars as step config interpolation.
 */

import { resolveVars } from './template-vars.js';

const FALSY_STRINGS = new Set(['false', '0', '']);

function isFalsy(value) {
  if (value == null) return true;
  if (value === false || value === 0) return true;
  if (typeof value === 'string' && FALSY_STRINGS.has(value.toLowerCase().trim())) return true;
  return false;
}

function isUnresolvedTemplate(value) {
  return typeof value === 'string' && /\$\{[^}]+\}/.test(value);
}

/**
 * Evaluate a condition template against the workflow execution context.
 *
 * @param {string|null|undefined} conditionTemplate - template string like '${steps.step_1.output.found}'
 * @param {object} context - { variables, steps } execution context
 * @returns {{ shouldRun: boolean, resolvedValue: any }}
 */
export function evaluateCondition(conditionTemplate, context) {
  if (conditionTemplate == null || conditionTemplate === '') {
    return { shouldRun: true, resolvedValue: null };
  }

  const resolved = resolveVars(conditionTemplate, context);

  // If the template didn't resolve (still contains ${...}), treat as falsy
  if (isUnresolvedTemplate(resolved)) {
    return { shouldRun: false, resolvedValue: resolved };
  }

  return {
    shouldRun: !isFalsy(resolved),
    resolvedValue: resolved,
  };
}
