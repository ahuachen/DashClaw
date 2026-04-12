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

// ---------------------------------------------------------------------------
// Tool classification (aligned with DashClaw hooks vocabulary so policies
// written for the Claude Code hooks also fire for OpenClaw tool calls)
// ---------------------------------------------------------------------------

interface ActionClassification {
  actionType: string;
  riskScore: number;
  reversible: boolean;
  systemsTouched: string[];
  declaredGoal: string;
}

const READONLY_COMMANDS = new Set([
  'cat', 'head', 'tail', 'less', 'more', 'wc', 'file', 'stat', 'du', 'df',
  'ls', 'tree', 'find', 'locate', 'which', 'whereis', 'type',
  'grep', 'rg', 'awk', 'cut', 'sort', 'uniq', 'diff', 'comm',
  'echo', 'printf', 'date', 'uname', 'whoami', 'pwd', 'hostname',
  'ps', 'top', 'htop', 'free', 'uptime', 'env', 'printenv',
]);

const GIT_READONLY = new Set([
  'status', 'log', 'diff', 'show', 'branch', 'tag', 'remote',
  'stash', 'describe', 'rev-parse', 'blame', 'ls-files',
]);

const DESTRUCTIVE_COMMANDS = new Set([
  'rm', 'rmdir', 'shred', 'mkfs', 'dd', 'truncate',
]);

const NETWORK_COMMANDS = new Set([
  'curl', 'wget', 'ssh', 'scp', 'rsync', 'ping',
]);

const PACKAGE_COMMANDS = new Set([
  'npm', 'yarn', 'pnpm', 'pip', 'pip3', 'cargo', 'go', 'gem',
  'brew', 'apt', 'apt-get', 'dnf',
]);

const DEPLOY_PATTERN = /(?:git\s+push|deploy|vercel|kubectl|terraform|docker\s+push|helm)/i;
const DESTRUCTIVE_PATTERN = /(?:rm\s+-rf|DROP\s+TABLE|DELETE\s+FROM|TRUNCATE)/i;
const SENSITIVE_PATH_PATTERN = /(?:\.env|secret|credential|private_key|\.pem|id_rsa|\.key)/i;

function classifyBash(
  command: string | undefined,
  defaultRisk: number,
): ActionClassification {
  if (!command) {
    return { actionType: 'other', riskScore: defaultRisk, reversible: true, systemsTouched: [], declaredGoal: 'Bash: (empty)' };
  }
  const goal = `Bash: ${command.slice(0, 120)}`;

  if (DESTRUCTIVE_PATTERN.test(command)) {
    return { actionType: 'security', riskScore: 90, reversible: false, systemsTouched: ['filesystem'], declaredGoal: goal };
  }
  if (DEPLOY_PATTERN.test(command)) {
    return { actionType: 'deploy', riskScore: 80, reversible: false, systemsTouched: ['production'], declaredGoal: goal };
  }

  const firstToken = command.trim().split(/[\s|;&]/)[0].replace(/^.*[/\\]/, '');

  if (firstToken === 'git') {
    const sub = command.match(/git\s+(\S+)/)?.[1] ?? '';
    if (GIT_READONLY.has(sub)) {
      return { actionType: 'review', riskScore: 10, reversible: true, systemsTouched: [], declaredGoal: goal };
    }
    if (sub === 'push') {
      return { actionType: 'deploy', riskScore: 75, reversible: false, systemsTouched: [], declaredGoal: goal };
    }
    return { actionType: 'apply', riskScore: 30, reversible: true, systemsTouched: [], declaredGoal: goal };
  }
  if (READONLY_COMMANDS.has(firstToken)) {
    return { actionType: 'review', riskScore: 10, reversible: true, systemsTouched: [], declaredGoal: goal };
  }
  if (DESTRUCTIVE_COMMANDS.has(firstToken)) {
    return { actionType: 'security', riskScore: 85, reversible: false, systemsTouched: ['filesystem'], declaredGoal: goal };
  }
  if (NETWORK_COMMANDS.has(firstToken)) {
    return { actionType: 'api', riskScore: 40, reversible: true, systemsTouched: [], declaredGoal: goal };
  }
  if (PACKAGE_COMMANDS.has(firstToken)) {
    return { actionType: 'build', riskScore: 30, reversible: true, systemsTouched: [], declaredGoal: goal };
  }
  return { actionType: 'other', riskScore: defaultRisk, reversible: true, systemsTouched: ['shell'], declaredGoal: goal };
}

function classifyFile(
  toolName: string,
  params: Record<string, unknown> | undefined,
  defaultRisk: number,
): ActionClassification {
  const filePath = String(params?.file_path ?? params?.path ?? '');
  const goal = `${toolName}: ${filePath || '(unknown)'}`;
  if (SENSITIVE_PATH_PATTERN.test(filePath)) {
    return { actionType: 'security', riskScore: 85, reversible: true, systemsTouched: ['filesystem'], declaredGoal: goal };
  }
  return { actionType: 'apply', riskScore: defaultRisk, reversible: true, systemsTouched: ['filesystem'], declaredGoal: goal };
}

function classifyToolCall(
  toolName: string,
  params: Record<string, unknown> | undefined,
  config: PluginConfig,
): ActionClassification {
  const defaultRisk = config.highRiskTools.has(toolName) ? 85 : config.riskScoreDefault;

  if (toolName === 'bash' || toolName === 'exec') {
    return classifyBash(params?.command as string | undefined, defaultRisk);
  }
  if (toolName === 'write' || toolName === 'edit' || toolName === 'apply_patch') {
    return classifyFile(toolName, params, defaultRisk);
  }
  if (['read', 'web_search', 'web_fetch', 'memory_search', 'memory_get', 'image'].includes(toolName)) {
    const target = String(params?.file_path ?? params?.path ?? params?.query ?? '');
    return {
      actionType: 'review',
      riskScore: Math.min(defaultRisk, 15),
      reversible: true,
      systemsTouched: [],
      declaredGoal: `${toolName}: ${target.slice(0, 120) || '(unknown)'}`,
    };
  }
  if (toolName === 'sessions_send') {
    return {
      actionType: 'message',
      riskScore: defaultRisk,
      reversible: false,
      systemsTouched: [],
      declaredGoal: `message: ${summarizeParams(params).slice(0, 120)}`,
    };
  }
  return {
    actionType: 'other',
    riskScore: defaultRisk,
    reversible: true,
    systemsTouched: [],
    declaredGoal: `${toolName}: ${summarizeParams(params).slice(0, 120)}`,
  };
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

      // Classify the tool call using the same vocabulary as DashClaw hooks
      // so policies written for Claude Code also fire for OpenClaw calls.
      const classification = classifyToolCall(toolName, params, config);
      const { actionType, riskScore, reversible, systemsTouched, declaredGoal } = classification;

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
          action_type: actionType,
          risk_score: riskScore,
          declared_goal: declaredGoal,
          reversible,
          systems_touched: systemsTouched,
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

      // Hard stop on block — never open an action record for a forbidden call.
      if (decision.decision === 'block') {
        return {
          block: true,
          blockReason: decision.reason || 'Blocked by DashClaw policy',
        };
      }

      if (decision.decision === 'warn') {
        console.warn(
          `[dashclaw-governance] WARN ${toolName}: ${decision.reason || 'flagged by policy'}`
        );
      }

      // Open a governance record. The server re-evaluates policy at this
      // point and is the authoritative source for HITL gating — even when
      // guard returned `allow`, the server may still set `pending_approval`
      // (for example, if the capability has `requires_approval=true`).
      //
      // NOTE: we MUST call `createAction` before `waitForApproval`, because
      // `waitForApproval` polls `GET /api/actions/:id` — which is backed by
      // the `action_records` table. `decision.action_id` from `guard()` is a
      // row in the separate `guard_decisions` table (prefix `act_gd_`) and
      // cannot be resolved by that endpoint.
      let createdActionId: string | undefined;
      let createdStatus: string | undefined;
      try {
        const created = await client.createAction({
          action_type: actionType,
          declared_goal: declaredGoal,
          risk_score: riskScore,
          reversible,
          systems_touched: systemsTouched,
          metadata: { openclaw_tool_name: toolName },
        });
        createdActionId =
          created.action_id ?? created.action?.action_id ?? created.action?.id;
        createdStatus = created.action?.status;
      } catch (err) {
        const msg = errorMessage(err) || 'unknown';
        console.warn(`[dashclaw-governance] createAction failed: ${msg}`);
        if (config.failClosed) {
          return {
            block: true,
            blockReason: `DashClaw action record could not be opened — fail-closed policy (${msg})`,
          };
        }
        // Fail-open: proceed without an action record. We cannot wait for
        // approval (no ID to wait on) and outcome recording will be skipped.
        return;
      }

      // If the server flagged this for human review, wait on the action
      // record we just created. Either guard said `require_approval` OR the
      // server upgraded the action to `pending_approval` independently — we
      // trust the server's `action.status` over the guard advice.
      const needsApproval =
        decision.decision === 'require_approval' ||
        createdStatus === 'pending_approval';

      if (needsApproval && createdActionId) {
        try {
          const { action } = await client.waitForApproval(createdActionId);
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
      }

      if (createdActionId) pendingActions.set(key, createdActionId);
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
