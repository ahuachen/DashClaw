/**
 * @swarmxai_guardrails/opencode-plugin — configuration
 *
 * Two independent security domains:
 *
 *   behaviorSecurity  — what the agent is allowed to DO
 *     Intercepts tool calls, runs approval flows, enforces action policies.
 *     Provider: 'dashclaw' (default) | 'custom'
 *     Env prefix: BEHAVIOR_SECURITY_*
 *
 *   modelSafety  — what the agent is allowed to PROCESS / SAY
 *     Scans input content before tool execution and output before LLM ingestion.
 *     Provider: 'openai-moderation' | 'llamaguard' | 'azure-content-safety' | 'custom'
 *     Env prefix: MODEL_SAFETY_*
 */

// ── Behavior Security ─────────────────────────────────────────────────────────

/**
 * 'dashclaw'  — DashClaw governance runtime (default).
 *              API contract: /api/guard, /api/actions, /api/agents/heartbeat
 * 'custom'    — Any service implementing the same REST contract.
 *              Drop-in replacement; same endpoint paths are called.
 */
export type BehaviorSecurityProvider = 'dashclaw' | 'custom';

export interface BehaviorSecurityConfig {
  provider: BehaviorSecurityProvider;
  baseUrl: string;
  apiKey: string;
  agentId: string;
  agentName: string;
  /** Block all tool calls when the behavior security service is unreachable. Default: true. */
  failClosed: boolean;
  riskScoreDefault: number;
  /** Tools that always get the maximum risk score (≥90). */
  highRiskTools: ReadonlySet<string>;
  /** Milliseconds to wait for a human approval before auto-denying. */
  approvalTimeoutMs: number;
  /** Tools completely skipped — not reported to the behavior security service. */
  ignoredTools: ReadonlySet<string>;
  /** Override the action_type sent to the backend per tool name. */
  toolActionTypes: Readonly<Record<string, string>>;
}

// ── Model Safety ─────────────────────────────────────────────────────────────

/**
 * 'openai-moderation'      — OpenAI Moderation API (free, text/image).
 *                            POST /v1/moderations
 * 'llamaguard'             — Meta LlamaGuard via any OpenAI-compatible endpoint
 *                            (Ollama, vLLM, Together, etc.).
 *                            POST /v1/chat/completions
 * 'azure-content-safety'   — Azure AI Content Safety.
 *                            POST /contentsafety/text:analyze
 * 'custom'                 — Any HTTP endpoint implementing the SwarmXAI
 *                            model safety contract (see model-safety.ts).
 */
export type ModelSafetyProvider =
  | 'openai-moderation'
  | 'llamaguard'
  | 'azure-content-safety'
  | 'custom';

export interface ModelSafetyConfig {
  enabled: boolean;
  provider: ModelSafetyProvider;
  /** Base URL of the model safety service. */
  endpoint: string;
  apiKey: string;
  /**
   * LlamaGuard only: model name to pass to the chat completions endpoint.
   * Default: 'meta-llama/LlamaGuard-3-8B'
   */
  model?: string;
  /** Scan tool arguments + declared_goal before tool execution. Default: true. */
  checkInput: boolean;
  /** Scan tool output before it is returned to the LLM. Default: true. */
  checkOutput: boolean;
  /** Block when the model safety service is unreachable. Default: false. */
  failClosed: boolean;
  /**
   * Content categories to enforce.
   * Empty = use provider defaults.
   * openai-moderation: ['hate', 'harassment', 'violence', 'self-harm', ...]
   * llamaguard: ['S1'–'S14'] (LlamaGuard 3 hazard taxonomy)
   * azure-content-safety: ['Hate', 'Sexual', 'Violence', 'SelfHarm']
   * custom: passed through as-is
   */
  categories: ReadonlyArray<string>;
}

// ── Top-level ─────────────────────────────────────────────────────────────────

export interface PluginConfig {
  behaviorSecurity: BehaviorSecurityConfig;
  modelSafety: ModelSafetyConfig;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function firstString(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c;
  }
  return '';
}

function asBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.toLowerCase();
    if (s === 'true' || s === '1' || s === 'yes') return true;
    if (s === 'false' || s === '0' || s === 'no') return false;
  }
  return fallback;
}

function asNumber(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.length > 0) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function asStringSet(v: unknown): Set<string> {
  if (Array.isArray(v)) {
    return new Set(v.filter((x): x is string => typeof x === 'string' && x.length > 0));
  }
  if (typeof v === 'string' && v.length > 0) {
    return new Set(v.split(',').map((s) => s.trim()).filter(Boolean));
  }
  return new Set();
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  if (typeof v === 'string' && v.length > 0) return v.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

function asStringMap(v: unknown): Record<string, string> {
  if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === 'string') out[k] = val;
    }
    return out;
  }
  return {};
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// ── Resolvers ─────────────────────────────────────────────────────────────────

function resolveBehaviorSecurity(
  raw: Record<string, unknown>,
  env: NodeJS.ProcessEnv,
): BehaviorSecurityConfig {
  const cfg = isRecord(raw.behaviorSecurity) ? raw.behaviorSecurity : raw;

  const baseUrl = firstString(cfg.baseUrl, env.BEHAVIOR_SECURITY_BASE_URL).replace(/\/$/, '');
  const apiKey = firstString(cfg.apiKey, env.BEHAVIOR_SECURITY_API_KEY);
  const agentId = firstString(cfg.agentId, env.BEHAVIOR_SECURITY_AGENT_ID) || 'opencode';
  const agentName = firstString(cfg.agentName, env.BEHAVIOR_SECURITY_AGENT_NAME) || agentId;
  const provider = (firstString(cfg.provider, env.BEHAVIOR_SECURITY_PROVIDER) ||
    'dashclaw') as BehaviorSecurityProvider;

  return {
    provider,
    baseUrl,
    apiKey,
    agentId,
    agentName,
    failClosed: asBool(cfg.failClosed ?? env.BEHAVIOR_SECURITY_FAIL_CLOSED, true),
    riskScoreDefault: asNumber(cfg.riskScoreDefault ?? env.BEHAVIOR_SECURITY_RISK_DEFAULT, 50),
    highRiskTools: asStringSet(cfg.highRiskTools ?? env.BEHAVIOR_SECURITY_HIGH_RISK_TOOLS),
    approvalTimeoutMs: asNumber(
      cfg.approvalTimeoutMs ?? env.BEHAVIOR_SECURITY_APPROVAL_TIMEOUT_MS,
      300_000,
    ),
    ignoredTools: asStringSet(cfg.ignoredTools ?? env.BEHAVIOR_SECURITY_IGNORED_TOOLS),
    toolActionTypes: asStringMap(cfg.toolActionTypes),
  };
}

function resolveModelSafety(
  raw: Record<string, unknown>,
  env: NodeJS.ProcessEnv,
): ModelSafetyConfig {
  const cfg = isRecord(raw.modelSafety) ? raw.modelSafety : {};

  const endpoint = firstString(cfg.endpoint, env.MODEL_SAFETY_ENDPOINT).replace(/\/$/, '');
  const enabled = endpoint.length > 0
    ? asBool(cfg.enabled ?? env.MODEL_SAFETY_ENABLED, true)
    : false;
  const provider = (firstString(cfg.provider, env.MODEL_SAFETY_PROVIDER) ||
    'custom') as ModelSafetyProvider;
  const model = firstString(cfg.model, env.MODEL_SAFETY_MODEL) || undefined;

  return {
    enabled,
    provider,
    endpoint,
    apiKey: firstString(cfg.apiKey, env.MODEL_SAFETY_API_KEY),
    model,
    checkInput: asBool(cfg.checkInput ?? env.MODEL_SAFETY_CHECK_INPUT, true),
    checkOutput: asBool(cfg.checkOutput ?? env.MODEL_SAFETY_CHECK_OUTPUT, true),
    failClosed: asBool(cfg.failClosed ?? env.MODEL_SAFETY_FAIL_CLOSED, false),
    categories: asStringArray(cfg.categories ?? env.MODEL_SAFETY_CATEGORIES),
  };
}

export function resolveConfig(raw: Record<string, unknown> | undefined): PluginConfig {
  const cfg = raw ?? {};
  const env: NodeJS.ProcessEnv =
    typeof process !== 'undefined' && process?.env ? process.env : {};

  return {
    behaviorSecurity: resolveBehaviorSecurity(cfg, env),
    modelSafety: resolveModelSafety(cfg, env),
  };
}

// ── Utilities (used by governance.ts) ────────────────────────────────────────

export function resolveActionType(
  toolName: string,
  overrides: Readonly<Record<string, string>>,
): string {
  return overrides[toolName] ?? toolName.toLowerCase();
}

const BUILTIN_RISK: Record<string, number> = {
  read: 5, glob: 5, grep: 5, list: 5, todoread: 5,
  webfetch: 20,
  todowrite: 30,
  edit: 60, write: 65, patch: 65,
  bash: 80,
};

export function inferRiskScore(toolName: string, fallback: number): number {
  return BUILTIN_RISK[toolName.toLowerCase()] ?? fallback;
}

const REVERSIBLE_TOOLS = new Set(['read', 'glob', 'grep', 'list', 'todoread', 'webfetch']);
export function inferReversible(toolName: string): boolean {
  return REVERSIBLE_TOOLS.has(toolName.toLowerCase());
}
