/**
 * @swarmxai_guardrails/opencode-plugin
 *
 * Routes every opencode tool call through the DashClaw governance loop:
 *
 *   1. tool.execute.before → guard() + (optional waitForApproval) + createAction()
 *   2. tool.execute.after  → updateOutcome()
 *   3. permission.ask      → guard() (override deny when policy says block)
 *   4. event               → session lifecycle heartbeat
 *
 * Install: see `docs/integrations/opencode.md`.
 *
 * Configuration shape mirrors the Multi-Agent Adapter Protocol — see
 * `docs/architecture/multi-agent-adapter.md` §3.
 */

import type { Hooks, Plugin, PluginInput, PluginOptions } from '@opencode-ai/plugin';

import { resolveConfig } from './config.js';
import {
  GovernanceBlockedError,
  GovernanceBridge,
} from './governance.js';

const guardrails: Plugin = async (input: PluginInput, options?: PluginOptions): Promise<Hooks> => {
  const cfg = resolveConfig(options as Record<string, unknown> | undefined);

  if (!cfg.behaviorSecurity.baseUrl || !cfg.behaviorSecurity.apiKey) {
    console.warn(
      '[swarmxai-guardrails] Behavior security is NOT active — set behaviorSecurity.baseUrl + apiKey ' +
        '(or BEHAVIOR_SECURITY_BASE_URL + BEHAVIOR_SECURITY_API_KEY env vars). All tool calls ' +
        'will run uncontrolled.',
    );
    return {};
  }

  const bridge = new GovernanceBridge(cfg.behaviorSecurity);
  // Fire-and-forget — heartbeat shouldn't delay opencode startup.
  void bridge.start({
    project: input.project?.id,
    directory: input.directory,
    worktree: input.worktree,
  });

  // Best-effort offline heartbeat on process exit.
  if (typeof process !== 'undefined' && typeof process.on === 'function') {
    const off = (): void => {
      void bridge.stop();
    };
    process.once('SIGINT', off);
    process.once('SIGTERM', off);
    process.once('beforeExit', off);
  }

  return {
    'tool.execute.before': async (i, _o) => {
      try {
        await bridge.beforeToolCall({
          tool: i.tool,
          sessionID: i.sessionID,
          callID: i.callID,
          // The output object holds the real args; the input object only
          // holds the routing identifiers. Pull args from the trigger output.
          // opencode passes the same `output.args` reference into our hook,
          // so we can read it from there.
          args: (_o as { args: unknown }).args,
        });
      } catch (err) {
        // Re-throw to abort the tool call. The opencode plugin trigger
        // wraps hooks in `Effect.promise`, so a thrown error here will
        // surface as a tool failure (which is exactly what `block` means).
        if (err instanceof GovernanceBlockedError) throw err;
        // Unexpected error — don't pretend it's a block, but do surface it.
        throw err;
      }
    },

    'tool.execute.after': async (i, o) => {
      // opencode uses metadata.error / metadata.errorMessage when a tool
      // surfaces a structured failure. Best-effort detection — anything
      // missing just gets reported as `ok`.
      const meta = (o.metadata ?? {}) as Record<string, unknown>;
      const failed = Boolean(meta.error) || typeof meta.errorMessage === 'string';
      const errorMessage =
        typeof meta.errorMessage === 'string'
          ? (meta.errorMessage as string)
          : typeof meta.error === 'string'
            ? (meta.error as string)
            : undefined;
      await bridge.afterToolCall({
        tool: i.tool,
        sessionID: i.sessionID,
        callID: i.callID,
        output: o as { title: string; output: string; metadata: unknown },
        failed,
        errorMessage,
      });
    },

    'permission.ask': async (i, o) => {
      await bridge.permissionAsk(
        i as { id?: string; type?: string; pattern?: string; metadata?: Record<string, unknown> },
        o,
      );
    },

    event: async ({ event }) => {
      // Session-end hook. opencode fires `session.deleted` and similar
      // lifecycle events on the global bus; we only do best-effort flush.
      const evt = event as { type?: string };
      if (evt && typeof evt.type === 'string' && evt.type.startsWith('session.')) {
        // Nothing strict to do here — heartbeats are debounced per-session,
        // and updateOutcome is called from the after hook. Reserved for
        // future use (token attribution, session-scoped flush, etc.).
      }
    },
  };
};

export default guardrails;
export { guardrails };
export { GovernanceBlockedError, GovernanceBridge } from './governance.js';
export { resolveConfig } from './config.js';
export type { PluginConfig } from './config.js';
