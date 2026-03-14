/**
 * DashClaw SDK v2 (Stable Runtime API)
 * Focused governance runtime client for AI agents.
 */

class ApprovalDeniedError extends Error {
  constructor(message, decision) {
    super(message);
    this.name = 'ApprovalDeniedError';
    this.decision = decision;
  }
}

class GuardBlockedError extends Error {
  constructor(decision) {
    super(decision.reason || 'Action blocked by policy');
    this.name = 'GuardBlockedError';
    this.decision = decision;
  }
}

class DashClaw {
  /**
   * @param {Object} options
   * @param {string} options.baseUrl - DashClaw base URL
   * @param {string} options.apiKey - API key for authentication
   * @param {string} options.agentId - Unique identifier for this agent
   */
  constructor({ baseUrl, apiKey, agentId }) {
    if (!baseUrl) throw new Error('baseUrl is required');
    if (!apiKey) throw new Error('apiKey is required');
    if (!agentId) throw new Error('agentId is required');

    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.agentId = agentId;
  }

  async _request(path, method = 'GET', body = null, params = null) {
    let url = `${this.baseUrl}${path}`;
    if (params) {
      const qs = new URLSearchParams(params).toString();
      if (qs) url += `?${qs}`;
    }

    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey
    };

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await res.json();

    if (!res.ok) {
      // Prioritize reason (from governance blocks) over generic error field
      const errorMessage = data.reason || data.error || `Request failed with status ${res.status}`;
      const err = new Error(errorMessage);
      err.status = res.status;
      err.details = data.details;
      err.decision = data;
      throw err;
    }

    return data;
  }

  /**
   * POST /api/guard — "Can I do X?"
   * @param {Object} context
   * @param {string} context.action - Action type (e.g. "deploy")
   * @param {string} [context.intent] - What the action aims to do
   * @param {number} [context.risk_score] - Risk score 0-100
   * @returns {Promise<{decision: 'allow'|'block'|'require_approval', action_id: string, reason: string, signals: string[]}>}
   */
  async guard(context) {
    return this._request('/api/guard', 'POST', {
      ...context,
      agent_id: context.agent_id || this.agentId,
    });
  }

  /**
   * POST /api/actions — "I am attempting X."
   * @param {Object} action
   * @param {string} action.action_type - e.g. "deploy"
   * @param {string} action.declared_goal - e.g. "deploy to production"
   * @returns {Promise<{action: Object, action_id: string}>}
   */
  async createAction(action) {
    const res = await this._request('/api/actions', 'POST', {
      ...action,
      agent_id: this.agentId,
    });
    return res;
  }

  /**
   * PATCH /api/actions/:id — "X finished with result Y."
   * @param {string} actionId
   * @param {Object} outcome
   */
  async updateOutcome(actionId, outcome) {
    return this._request(`/api/actions/${actionId}`, 'PATCH', {
      ...outcome,
      timestamp_end: outcome.timestamp_end || new Date().toISOString()
    });
  }

  /**
   * POST /api/assumptions — "I believe Z is true while doing X."
   * @param {Object} assumption
   */
  async recordAssumption(assumption) {
    return this._request('/api/assumptions', 'POST', assumption);
  }

  /**
   * GET /api/actions/:id — Polling helper for human approval.
   */
  async waitForApproval(actionId, { timeout = 300000, interval = 5000 } = {}) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const { action } = await this._request(`/api/actions/${actionId}`, 'GET');
      if (action.status === 'running' || action.status === 'completed') return action;
      if (action.status === 'failed' || action.status === 'cancelled') {
        throw new ApprovalDeniedError(action.error_message || 'Operator denied the action.', action.status);
      }
      await new Promise(r => setTimeout(r, interval));
    }
    throw new Error(`Timed out waiting for approval of action ${actionId}`);
  }
}

export { DashClaw, ApprovalDeniedError, GuardBlockedError };
