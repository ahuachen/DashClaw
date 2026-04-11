/**
 * @dashclaw/openclaw-plugin
 *
 * OpenClaw plugin that routes every tool call through DashClaw governance:
 *   1. `before_tool_call` → `guard()` + optional `waitForApproval()` +
 *      `createAction()` to open a governance record.
 *   2. `after_tool_call`  → `updateOutcome()` to close that record.
 *
 * Type accuracy notes (verified against `openclaw` plugin SDK types):
 *   - `PluginHookBeforeToolCallResult` uses `blockReason`, not `reason`.
 *   - `PluginKind` is `"memory" | "context-engine"` — neither applies to this
 *     generic hook plugin, so the manifest and `definePluginEntry` call both
 *     omit `kind`.
 *   - Event/context field shapes come from `PluginHookBeforeToolCallEvent`,
 *     `PluginHookAfterToolCallEvent`, and `PluginHookToolContext`. No
 *     defensive fallbacks for alternative field names are needed.
 *
 * The DashClaw client is cached at module scope and rebuilt only when the
 * resolved config key changes, mirroring the pattern used by OpenClaw's
 * bundled MemOS plugin.
 */

import {
  definePluginEntry,
  type OpenClawPluginApi,
} from 'openclaw/plugin-sdk/plugin-entry';
import {
  DashClaw,
  type ActionRecord,
  type GuardDecision,
} from 'dashclaw';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

interface PluginConfig {
  dashclawUrl: string;
  dashclawApiKey: string;
  agentId: string;
  failClosed: boolean;
  riskScoreDefault: number;
  highRiskTools: ReadonlySet<string>;
}

function resolveConfig(raw: Record<string, unknown> | undefined): PluginConfig {
  const cfg = raw ?? {};
  const failClosed = cfg.failClosed !== false; // default true
  const riskScoreDefault =
    typeof cfg.riskScoreDefault === 'number' ? cfg.riskScoreDefault : 50;
  const highRiskTools = new Set<string>(
    Array.isArray(cfg.highRiskTools)
      ? cfg.highRiskTools.filter((v): v is string => typeof v === 'string')
      : []
  );
  return {
    dashclawUrl: typeof cfg.dashclawUrl === 'string' ? cfg.dashclawUrl : '',
    dashclawApiKey:
      typeof cfg.dashclawApiKey === 'string' ? cfg.dashclawApiKey : '',
    agentId: typeof cfg.agentId === 'string' && cfg.agentId ? cfg.agentId : 'openclaw',
    failClosed,
    riskScoreDefault,
    highRiskTools,
  };
}

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let cachedClient: DashClaw | null = null;
let cachedClientKey = '';

/** Maps synthetic call key → DashClaw action_id so `after_tool_call` can close it. */
const pendingActions = new Map<string, string>();

function getClient(config: PluginConfig): DashClaw {
  const key = `${config.dashclawUrl}|${config.dashclawApiKey}|${config.agentId}`;
  if (cachedClient && cachedClientKey === key) return cachedClient;

  if (!config.dashclawUrl || !config.dashclawApiKey) {
    throw new Error('dashclawUrl and dashclawApiKey are required');
  }

  cachedClient = new DashClaw({
    baseUrl: config.dashclawUrl,
    apiKey: config.dashclawApiKey,
    agentId: config.agentId,
  });
  cachedClientKey = key;
  return cachedClient;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function summarizeParams(params: Record<string, unknown> | undefined): string {
  if (!params) return '';
  let serialized: string;
  try {
    serialized = JSON.stringify(params);
  } catch {
    return '[unserializable params]';
  }
  if (serialized.length <= 500) return serialized;
  return serialized.slice(0, 500) + '…[truncated]';
}

function callKey(
  toolName: string,
  toolCallId: string | undefined,
  runId: string | undefined
): string {
  // Prefer the provider-supplied tool call ID; fall back to runId-scoped tool
  // name so a later `after_tool_call` without a toolCallId can still find the
  // pending record.
  if (toolCallId) return `id:${toolCallId}`;
  if (runId) return `run:${runId}:${toolName}`;
  return `tool:${toolName}`;
}

function errorMessage(err: unknown): string {
  if (!err) return '';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    return typeof m === 'string' ? m : '';
  }
  return '';
}

function isApproved(action: ActionRecord | undefined): boolean {
  if (!action) return false;
  if (action.approved_by) return true;
  return action.status === 'running' || action.status === 'completed';
}

// ---------------------------------------------------------------------------
// Plugin entry
// ---------------------------------------------------------------------------

export default definePluginEntry({
  id: 'dashclaw-governance',
  name: 'DashClaw Governance',
  description:
    'Policy enforcement, human-in-the-loop approval, and decision recording for every OpenClaw tool call. Powered by DashClaw.',

  register(api: OpenClawPluginApi): void {
    const config = resolveConfig(api.pluginConfig);

    // -----------------------------------------------------------------------
    // Governance gate
    // -----------------------------------------------------------------------
    api.on('before_tool_call', async (event, _ctx) => {
      const { toolName, params, toolCallId, runId } = event;
      const key = callKey(toolName, toolCallId, runId);
      const riskScore = config.highRiskTools.has(toolName)
        ? 85
        : config.riskScoreDefault;
      const paramSummary = summarizeParams(params);

      let client: DashClaw;
      try {
        client = getClient(config);
      } catch (err) {
        const msg = errorMessage(err) || 'unknown error';
        if (config.failClosed) {
          return { block: true, blockReason: `DashClaw config error: ${msg}` };
        }
        console.warn(`[dashclaw-governance] config error (fail-open): ${msg}`);
        return;
      }

      let decision: GuardDecision;
      try {
        decision = await client.guard({
          action_type: toolName,
          risk_score: riskScore,
          context: { tool: toolName, params: paramSummary },
        });
      } catch (err) {
        const msg = errorMessage(err) || 'unknown error';
        if (config.failClosed) {
          return {
            block: true,
            blockReason: `DashClaw unreachable — fail-closed policy (${msg})`,
          };
        }
        console.warn(`[dashclaw-governance] guard call failed (fail-open): ${msg}`);
        return;
      }

      switch (decision.decision) {
        case 'block':
          return {
            block: true,
            blockReason: decision.reason || 'Blocked by DashClaw policy',
          };

        case 'warn':
          console.warn(
            `[dashclaw-governance] WARN ${toolName}: ${decision.reason || 'flagged by policy'}`
          );
          break;

        case 'require_approval':
          try {
            const { action } = await client.waitForApproval(decision.action_id);
            if (!isApproved(action)) {
              return {
                block: true,
                blockReason: action?.error_message || 'Action denied by operator',
              };
            }
          } catch (err) {
            return {
              block: true,
              blockReason: `Approval denied or wait failed: ${errorMessage(err) || 'denied'}`,
            };
          }
          break;

        case 'allow':
        default:
          break;
      }

      // Decision permits the call. Open a governance record so we can attach
      // the outcome in `after_tool_call`. If createAction fails, fall back to
      // the guard's action_id — record-keeping must never break a tool call
      // that policy already approved.
      try {
        const created = await client.createAction({
          action_type: toolName,
          declared_goal: paramSummary || `Tool call: ${toolName}`,
          risk_score: riskScore,
        });
        const actionId =
          created.action_id ??
          created.action?.action_id ??
          created.action?.id ??
          decision.action_id;
        if (actionId) pendingActions.set(key, actionId);
      } catch (err) {
        console.warn(
          `[dashclaw-governance] createAction failed: ${errorMessage(err) || 'unknown'}`
        );
        if (decision.action_id) pendingActions.set(key, decision.action_id);
      }

      return;
    });

    // -----------------------------------------------------------------------
    // Outcome recorder
    // -----------------------------------------------------------------------
    api.on('after_tool_call', async (event, _ctx) => {
      const { toolName, toolCallId, runId, error } = event;
      const key = callKey(toolName, toolCallId, runId);
      const actionId = pendingActions.get(key);
      if (!actionId) return;
      pendingActions.delete(key);

      const status = error ? 'failed' : 'completed';

      let client: DashClaw;
      try {
        client = getClient(config);
      } catch {
        return; // No client → cannot record; never break tool execution.
      }

      try {
        await client.updateOutcome(actionId, {
          status,
          ...(error ? { error_message: error } : {}),
        });
      } catch (err) {
        console.warn(
          `[dashclaw-governance] updateOutcome failed: ${errorMessage(err) || 'unknown'}`
        );
      }
    });
  },
});
