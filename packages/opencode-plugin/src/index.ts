/**
 * @swarmxai_guardrails/opencode-plugin
 *
 * Unified security aspect for opencode — behavior security + model safety
 * as a single plugin entry point.
 *
 * Execution order per tool call:
 *
 *   tool.execute.before
 *     1. modelSafety.checkInput  — scan declared_goal + tool args
 *     2. behaviorSecurity.guard  — policy decision (allow/block/approve)
 *     3. behaviorSecurity.createAction + optional waitForApproval
 *
 *   tool.execute.after
 *     4. behaviorSecurity.updateOutcome — record result
 *     5. modelSafety.checkOutput        — scan tool output (best-effort)
 *
 *   permission.ask
 *     → behaviorSecurity.guard (soft gate)
 *
 * Configure via opencode.json or env vars — see config.ts for full reference.
 */

import type { Hooks, Plugin, PluginInput, PluginOptions } from '@opencode-ai/plugin';

import { resolveConfig } from './config.js';
import { GovernanceBlockedError, GovernanceBridge } from './governance.js';
import {
  ModelSafetyBridge,
  ModelSafetyUnreachableError,
  ModelSafetyViolationError,
} from './model-safety.js';

const guardrails: Plugin = async (
  input: PluginInput,
  options?: PluginOptions,
): Promise<Hooks> => {
  const cfg = resolveConfig(options as Record<string, unknown> | undefined);

  // ── Validate required config ─────────────────────────────────────────────

  const bs = cfg.behaviorSecurity;
  if (!bs.baseUrl || !bs.apiKey) {
    console.warn(
      '[swarmxai-guardrails] Behavior security is NOT active — ' +
        'set behaviorSecurity.baseUrl + apiKey ' +
        '(or BEHAVIOR_SECURITY_BASE_URL + BEHAVIOR_SECURITY_API_KEY). ' +
        'All tool calls will run uncontrolled.',
    );
    return {};
  }

  // ── Initialize bridges ───────────────────────────────────────────────────

  const behavior = new GovernanceBridge(bs);
  const modelSafety = new ModelSafetyBridge(cfg.modelSafety);

  void behavior.start({
    project: input.project?.id,
    directory: input.directory,
    worktree: input.worktree,
  });

  if (typeof process !== 'undefined' && typeof process.on === 'function') {
    const off = (): void => { void behavior.stop(); };
    process.once('SIGINT', off);
    process.once('SIGTERM', off);
    process.once('beforeExit', off);
  }

  // ── Hooks ────────────────────────────────────────────────────────────────

  return {
    'tool.execute.before': async (i, _o) => {
      const args = (_o as { args: unknown }).args;
      const declaredGoal = `opencode tool call: ${i.tool}`;

      // Step 1 — model safety: scan input
      if (modelSafety.enabled && cfg.modelSafety.checkInput) {
        const inputText = buildInputText(declaredGoal, args);
        try {
          const result = await modelSafety.scan(inputText, 'input', {
            tool: i.tool,
            session_id: i.sessionID,
            call_id: i.callID,
          });
          if (!result.safe) {
            throw new ModelSafetyViolationError(result);
          }
        } catch (err) {
          if (err instanceof ModelSafetyViolationError) throw err;
          if (err instanceof ModelSafetyUnreachableError) {
            if (cfg.modelSafety.failClosed) throw err;
            console.warn('[swarmxai-guardrails:model-safety] unreachable (failClosed=false), continuing');
          }
        }
      }

      // Step 2+3 — behavior security: guard + approve
      try {
        await behavior.beforeToolCall({
          tool: i.tool,
          sessionID: i.sessionID,
          callID: i.callID,
          args,
        });
      } catch (err) {
        if (err instanceof GovernanceBlockedError) throw err;
        throw err;
      }
    },

    'tool.execute.after': async (i, o) => {
      const meta = (o.metadata ?? {}) as Record<string, unknown>;
      const failed = Boolean(meta.error) || typeof meta.errorMessage === 'string';
      const errorMessage =
        typeof meta.errorMessage === 'string' ? meta.errorMessage
        : typeof meta.error === 'string' ? meta.error
        : undefined;

      const toolOutput = o as { title: string; output: string; metadata: unknown };

      // Step 4 — behavior security: record outcome
      await behavior.afterToolCall({
        tool: i.tool,
        sessionID: i.sessionID,
        callID: i.callID,
        output: toolOutput,
        failed,
        errorMessage,
      });

      // Step 5 — model safety: scan output (best-effort, non-blocking)
      if (modelSafety.enabled && cfg.modelSafety.checkOutput && !failed) {
        const outputText = toolOutput.output ?? '';
        if (outputText) {
          modelSafety.scan(outputText, 'output', {
            tool: i.tool,
            session_id: i.sessionID,
            call_id: i.callID,
          }).then((result) => {
            if (!result.safe) {
              console.warn(
                `[swarmxai-guardrails:model-safety] output flagged for tool=${i.tool}: ` +
                  result.flaggedCategories.join(', '),
                result.reason ?? '',
              );
            }
          }).catch(() => {
            // output scanning is always best-effort
          });
        }
      }
    },

    'permission.ask': async (i, o) => {
      await behavior.permissionAsk(
        i as { id?: string; type?: string; pattern?: string; metadata?: Record<string, unknown> },
        o,
      );
    },

    event: async ({ event }) => {
      // Reserved for session lifecycle events (session.deleted, etc.).
      void event;
    },
  };
};

export default guardrails;
export { guardrails };

// Named re-exports for advanced consumers
export { GovernanceBlockedError, GovernanceBridge } from './governance.js';
export { ModelSafetyBridge, ModelSafetyViolationError, ModelSafetyUnreachableError } from './model-safety.js';
export { resolveConfig } from './config.js';
export type { PluginConfig, BehaviorSecurityConfig, ModelSafetyConfig } from './config.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildInputText(goal: string, args: unknown): string {
  try {
    const argsStr = typeof args === 'string' ? args : JSON.stringify(args);
    return `${goal}\n\nArguments:\n${argsStr}`.slice(0, 4000);
  } catch {
    return goal;
  }
}
