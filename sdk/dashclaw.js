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
   */
  async createAction(action) {
    return this._request('/api/actions', 'POST', {
      ...action,
      agent_id: this.agentId,
    });
  }

  /**
   * PATCH /api/actions/:id — "X finished with result Y."
   */
  async updateOutcome(actionId, outcome) {
    return this._request(`/api/actions/${actionId}`, 'PATCH', {
      ...outcome,
      timestamp_end: outcome.timestamp_end || new Date().toISOString()
    });
  }

  /**
   * GET /api/actions/:id — Fetch a single action by ID.
   */
  async getAction(actionId) {
    return this._request(`/api/actions/${actionId}`, 'GET');
  }

  /**
   * GET /api/actions?status=pending_approval — List actions awaiting approval.
   */
  async getPendingApprovals(limit = 20, offset = 0) {
    return this._request('/api/actions', 'GET', null, {
      status: 'pending_approval',
      limit,
      offset,
    });
  }

  /**
   * POST /api/actions/:id/approve — Approve or deny an action.
   * @param {string} actionId
   * @param {'allow'|'deny'} decision
   * @param {string} [reasoning]
   */
  async approveAction(actionId, decision, reasoning) {
    const body = { decision };
    if (reasoning) body.reasoning = reasoning;
    return this._request(`/api/actions/${actionId}/approve`, 'POST', body);
  }

  /**
   * POST /api/assumptions — "I believe Z is true while doing X."
   */
  async recordAssumption(assumption) {
    return this._request('/api/assumptions', 'POST', assumption);
  }

  /**
   * GET /api/actions/:id — Polling helper for human approval.
   */
  async waitForApproval(actionId, { timeout = 300000, interval = 5000 } = {}) {
    const startTime = Date.now();
    let wasPending = false;
    let printedBlock = false;

    while (Date.now() - startTime < timeout) {
      const { action } = await this._request(`/api/actions/${actionId}`, 'GET');

      // Print structured approval block on first fetch
      if (!printedBlock) {
        printedBlock = true;
        try {
          const actionType = action.action_type || 'unknown';
          const riskScore = action.risk_score != null ? String(action.risk_score) : '-';
          const goal = action.declared_goal || '-';
          const agent = action.agent_id || this.agentId;
          const replayUrl = `${this.baseUrl}/replay/${actionId}`;

          const lines = [
            '\u2554\u2550\u2550 DashClaw Approval Required \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557',
            `  Action ID:   ${actionId}`,
            `  Agent:       ${agent}`,
            `  Action:      ${actionType}`,
            '  Policy:      require_approval',
            `  Risk Score:  ${riskScore}`,
            `  Goal:        ${goal}`,
            '',
            `  Replay:      ${replayUrl}`,
            '',
            '  Waiting for approval... (Ctrl+C to abort)',
            '\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d',
          ];
          process.stdout.write('\n' + lines.join('\n') + '\n\n');
        } catch (_) {
          // Rendering failure must not prevent the wait from proceeding
        }
      }
      
      if (action.status === 'pending_approval') {
        wasPending = true;
      }

      // Explicitly unblocked by approval metadata
      if (action.approved_by) return action;

      // Denial cases
      if (action.status === 'failed' || action.status === 'cancelled') {
        throw new ApprovalDeniedError(action.error_message || 'Operator denied the action.', action.status);
      }

      // Requirement 4: If an action leaves pending_approval without approval metadata, throw an error.
      // This prevents "auto-approval" bugs where status is changed by non-approval paths.
      if (wasPending && action.status !== 'pending_approval') {
        throw new Error(`Action ${actionId} left pending_approval state without explicit approval metadata (Status: ${action.status})`);
      }

      // If allowed directly (never intercepted), return immediately
      if (!wasPending && action.status === 'running') {
        return { action };
      }

      await new Promise(r => setTimeout(r, interval));
    }
    throw new Error(`Timed out waiting for approval of action ${actionId}`);
  }

  /**
   * POST /api/agents/heartbeat
   */
  async heartbeat(status = 'online', metadata = null) {
    return this._request('/api/agents/heartbeat', 'POST', {
      agent_id: this.agentId,
      status,
      metadata
    });
  }

  /**
   * POST /api/agents/connections
   */
  async reportConnections(connections) {
    return this._request('/api/agents/connections', 'POST', {
      agent_id: this.agentId,
      connections
    });
  }

  /**
   * POST /api/actions/loops
   */
  async registerOpenLoop(actionId, loopType, description, metadata = null) {
    return this._request('/api/actions/loops', 'POST', {
      action_id: actionId,
      loop_type: loopType,
      description,
      metadata
    });
  }

  /**
   * PATCH /api/actions/loops/:id
   */
  async resolveOpenLoop(loopId, status, resolution = null) {
    return this._request(`/api/actions/loops/${loopId}`, 'PATCH', {
      status,
      resolution
    });
  }

  /**
   * GET /api/actions/signals
   */
  async getSignals() {
    return this._request('/api/actions/signals');
  }

  /**
   * GET /api/learning/analytics/velocity
   */
  async getLearningVelocity(lookbackDays = 30) {
    return this._request('/api/learning/analytics/velocity', 'GET', null, {
      agent_id: this.agentId,
      lookback_days: lookbackDays
    });
  }

  /**
   * GET /api/learning/analytics/curves
   */
  async getLearningCurves(lookbackDays = 60) {
    return this._request('/api/learning/analytics/curves', 'GET', null, {
      agent_id: this.agentId,
      lookback_days: lookbackDays
    });
  }

  /**
   * POST /api/prompts/render
   */
  async renderPrompt({ template_id, version_id, variables, record = false }) {
    return this._request('/api/prompts/render', 'POST', {
      template_id,
      version_id,
      variables,
      agent_id: this.agentId,
      record
    });
  }

  /**
   * POST /api/evaluations/scorers
   */
  async createScorer(name, scorer_type, config = null, description = null) {
    return this._request('/api/evaluations/scorers', 'POST', {
      name,
      scorer_type,
      config,
      description
    });
  }

  /**
   * POST /api/scoring/profiles
   */
  async createScoringProfile(profile) {
    return this._request('/api/scoring/profiles', 'POST', profile);
  }

  /**
   * GET /api/compliance/map
   */
  async mapCompliance(framework) {
    return this._request(`/api/compliance/map`, 'GET', null, { framework });
  }

  /**
   * GET /api/policies/proof
   */
  async getProofReport(format = 'json') {
    return this._request('/api/policies/proof', 'GET', null, { format });
  }

  /**
   * GET /api/activity
   */
  async getActivityLogs(filters = {}) {
    return this._request('/api/activity', 'GET', null, filters);
  }

  /**
   * POST /api/webhooks
   */
  async createWebhook(url, events = null) {
    return this._request('/api/webhooks', 'POST', {
      url,
      events
    });
  }
}

export { DashClaw, ApprovalDeniedError, GuardBlockedError };
