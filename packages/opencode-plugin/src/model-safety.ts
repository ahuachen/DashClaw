/**
 * Model safety client — provider-agnostic content scanning.
 *
 * Scans text for harmful / non-compliant content before it enters or exits
 * the LLM's context window. Supports four providers:
 *
 *   openai-moderation    — OpenAI Moderation API
 *   llamaguard           — Meta LlamaGuard (any OpenAI-compatible endpoint)
 *   azure-content-safety — Azure AI Content Safety
 *   custom               — Any endpoint implementing the SwarmXAI contract
 *
 * All providers share the same output shape: ModelSafetyResult.
 */

import type { ModelSafetyConfig } from './config.js';
import { stringifyError } from './client.js';

// ── Output contract ───────────────────────────────────────────────────────────

export interface ModelSafetyResult {
  safe: boolean;
  /** Provider-specific categories that triggered (empty when safe). */
  flaggedCategories: string[];
  /** Human-readable explanation from the provider. */
  reason?: string;
  /** Raw provider response for audit logging. */
  raw?: unknown;
}

// ── Error types ───────────────────────────────────────────────────────────────

export class ModelSafetyUnreachableError extends Error {
  constructor(cause: unknown) {
    super(`Model safety service unreachable: ${stringifyError(cause)}`);
    this.name = 'ModelSafetyUnreachableError';
  }
}

export class ModelSafetyViolationError extends Error {
  constructor(public result: ModelSafetyResult) {
    super(result.reason ?? `Content flagged: ${result.flaggedCategories.join(', ')}`);
    this.name = 'ModelSafetyViolationError';
  }
}

// ── Main bridge ───────────────────────────────────────────────────────────────

export class ModelSafetyBridge {
  private readonly cfg: ModelSafetyConfig;

  constructor(cfg: ModelSafetyConfig) {
    this.cfg = cfg;
  }

  get enabled(): boolean {
    return this.cfg.enabled;
  }

  /**
   * Scan content. Returns a safe/unsafe result.
   * Never throws on provider error — caller decides how to handle via failClosed.
   */
  async scan(
    text: string,
    context: 'input' | 'output',
    meta?: Record<string, unknown>,
  ): Promise<ModelSafetyResult> {
    if (!this.cfg.enabled) return SAFE;
    if (!text.trim()) return SAFE;

    try {
      switch (this.cfg.provider) {
        case 'openai-moderation':
          return await this.scanOpenAI(text);
        case 'llamaguard':
          return await this.scanLlamaGuard(text, context);
        case 'azure-content-safety':
          return await this.scanAzure(text);
        case 'custom':
          return await this.scanCustom(text, context, meta);
      }
    } catch (err) {
      if (err instanceof ModelSafetyUnreachableError) throw err;
      throw new ModelSafetyUnreachableError(err);
    }
  }

  // ── OpenAI Moderation ─────────────────────────────────────────────────────

  private async scanOpenAI(text: string): Promise<ModelSafetyResult> {
    const res = await this.post(`${this.cfg.endpoint}/v1/moderations`, { input: text });

    const results = (res as { results?: OpenAIModerationItem[] }).results ?? [];
    const item = results[0];
    if (!item) return SAFE;

    if (!item.flagged) return { safe: true, flaggedCategories: [], raw: res };

    const activeCategories = this.cfg.categories.length > 0
      ? this.cfg.categories
      : Object.keys(item.categories);

    const flagged = activeCategories.filter(
      (cat) => item.categories[cat as keyof typeof item.categories] === true,
    );

    return {
      safe: false,
      flaggedCategories: flagged,
      reason: `Content flagged by OpenAI moderation: ${flagged.join(', ')}`,
      raw: res,
    };
  }

  // ── LlamaGuard ────────────────────────────────────────────────────────────

  private async scanLlamaGuard(
    text: string,
    context: 'input' | 'output',
  ): Promise<ModelSafetyResult> {
    const model = this.cfg.model ?? 'meta-llama/LlamaGuard-3-8B';
    const role = context === 'input' ? 'user' : 'assistant';

    const body = {
      model,
      messages: [{ role, content: text }],
      max_tokens: 20,
      temperature: 0,
    };

    const res = await this.post(`${this.cfg.endpoint}/v1/chat/completions`, body);
    const response: string =
      (res as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content?.trim() ?? '';

    // LlamaGuard response: "safe" or "unsafe\nS<N>"
    if (response.toLowerCase().startsWith('safe')) {
      return { safe: true, flaggedCategories: [], raw: res };
    }

    const lines = response.split('\n').map((l) => l.trim());
    const hazardCodes = lines.slice(1).filter(Boolean); // e.g. ['S1', 'S6']

    const activeCategories = this.cfg.categories.length > 0
      ? this.cfg.categories
      : hazardCodes;

    const flagged = activeCategories.length > 0
      ? activeCategories.filter((c) => hazardCodes.includes(c) || this.cfg.categories.length === 0)
      : hazardCodes;

    return {
      safe: false,
      flaggedCategories: flagged,
      reason: `LlamaGuard flagged hazard codes: ${flagged.join(', ')}`,
      raw: res,
    };
  }

  // ── Azure Content Safety ──────────────────────────────────────────────────

  private async scanAzure(text: string): Promise<ModelSafetyResult> {
    const categories = this.cfg.categories.length > 0
      ? this.cfg.categories
      : ['Hate', 'Sexual', 'Violence', 'SelfHarm'];

    const body = {
      text,
      categories,
      outputType: 'FourSeverityLevels',
    };

    const url =
      `${this.cfg.endpoint}/contentsafety/text:analyze?api-version=2024-02-15-preview`;

    const res = await this.post(url, body);
    const analysis = (res as { categoriesAnalysis?: AzureCategory[] }).categoriesAnalysis ?? [];

    // Severity 0 = safe, 2/4/6 = low/medium/high
    const flagged = analysis
      .filter((item) => (item.severity ?? 0) > 0)
      .map((item) => item.category);

    if (flagged.length === 0) return { safe: true, flaggedCategories: [], raw: res };

    return {
      safe: false,
      flaggedCategories: flagged,
      reason: `Azure Content Safety flagged: ${flagged.join(', ')}`,
      raw: res,
    };
  }

  // ── Custom provider ───────────────────────────────────────────────────────

  /**
   * SwarmXAI custom model safety contract.
   *
   * Request:
   *   POST <endpoint>/check
   *   { text, context, categories, meta }
   *
   * Response:
   *   { safe: boolean, flaggedCategories: string[], reason?: string }
   */
  private async scanCustom(
    text: string,
    context: 'input' | 'output',
    meta?: Record<string, unknown>,
  ): Promise<ModelSafetyResult> {
    const body = {
      text,
      context,
      categories: this.cfg.categories,
      meta: meta ?? null,
    };

    const res = await this.post(`${this.cfg.endpoint}/check`, body);
    const r = res as Partial<ModelSafetyResult>;

    return {
      safe: r.safe !== false,
      flaggedCategories: Array.isArray(r.flaggedCategories) ? r.flaggedCategories : [],
      reason: r.reason,
      raw: res,
    };
  }

  // ── HTTP helper ───────────────────────────────────────────────────────────

  private async post(url: string, body: unknown): Promise<unknown> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 10_000);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.cfg.apiKey) headers['Authorization'] = `Bearer ${this.cfg.apiKey}`;
      // Azure uses a different auth header
      if (this.cfg.provider === 'azure-content-safety' && this.cfg.apiKey) {
        headers['Ocp-Apim-Subscription-Key'] = this.cfg.apiKey;
        delete headers['Authorization'];
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: ac.signal,
      });
      const text = await res.text();
      const data: unknown = text ? safeJson(text) : null;
      if (!res.ok) {
        throw new Error(`ModelSafety POST ${url} → ${res.status}: ${text || res.statusText}`);
      }
      return data;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new ModelSafetyUnreachableError(`POST ${url} timed out`);
      }
      if (err instanceof TypeError) throw new ModelSafetyUnreachableError(err);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

// ── Private types ─────────────────────────────────────────────────────────────

interface OpenAIModerationItem {
  flagged: boolean;
  categories: Record<string, boolean>;
  category_scores: Record<string, number>;
}

interface AzureCategory {
  category: string;
  severity?: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SAFE: ModelSafetyResult = { safe: true, flaggedCategories: [] };

function safeJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}
