# Hosted Stack Picker UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Try it hosted" section at the top of `/connect` that lets a visitor pick their agent stack (Claude Code / OpenClaw / Codex / LangChain / MCP), mint a trial workspace via Plan 1's provisioning endpoint, and copy a pre-filled integration config with the token + endpoint baked in.

**Architecture:** Server-rendered wrapper gated on `DASHCLAW_HOSTED=true` (self-host deploys don't see the section). Client component owns stack-picker state, provisioning fetch, and result display. Pure template functions in a separate module generate per-stack config blobs by substituting `{endpoint, apiKey, workspaceId}` into static strings. Optional Turnstile widget renders when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind with existing DashClaw design tokens, `lucide-react` icons, Vitest + `@testing-library/react` for component tests.

**Scope boundary:**
- IN: new `/connect` section, stack picker UI, 5 template functions, client provisioning flow, Turnstile widget integration, copy-to-clipboard, tests for templates + component state.
- OUT: any new API route (Plan 1 covers provisioning); actual npm installer packages (Plan 3); hosted-instance infra / DNS (Plan 4); post-install "verify it works" ping (Plan 3 scope).

**Non-negotiables (from project memory + `.impeccable.md`):**
- Design tokens only — no hardcoded hex. Use `bg-surface-*`, `text-text-*`, `border-*` classes.
- Brand orange = signal, not decoration. Use for the primary CTA and the "save this key" warning only.
- `lucide-react` for icons, no others.
- SDK doc checklist from `MEMORY.md` applies to the `NEXT_PUBLIC_TURNSTILE_SITE_KEY` env var (update `.env.example`).
- Calm under pressure — operator surface, no hype copy, no confetti, no "success!" exclamations.

---

## File Structure

**Create:**
- `app/connect/hostedTemplates.js` — 5 pure functions, one per stack. Each takes `{endpoint, apiKey, workspaceId}` and returns `{language, code}`. No React, no DOM.
- `app/connect/HostedProvisionClient.js` — `'use client'` component. Stack picker + provisioning button + result area. Re-uses existing `CopyButton` pattern (imported from a shared module OR copied inline, see Task 3 note).
- `app/connect/HostedProvisionSection.js` — server component. Renders nothing when `!isHostedMode()`. Otherwise renders the section shell + mounts the client component.
- `app/lib/hosted/publicConfig.js` — tiny server helper that reads `process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY` and the hosted flag, returned as a plain object passable to client components.
- `__tests__/unit/hosted/hosted-templates.test.js` — 5 tests, one per stack, verifying correct substitution and no missing fields.
- `__tests__/unit/hosted/hosted-provision-client.test.js` — RTL tests for the client component (picker selection, fetch happy path, fetch error display, copy button).

**Modify:**
- `app/connect/page.js` — import `HostedProvisionSection`, render it above the existing MCP Server section.
- `.env.example` — add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` line.
- `PROJECT_DETAILS.md` — one-line note that `/connect` now has a gated "Try it hosted" flow when `DASHCLAW_HOSTED=true`.
- `app/lib/hosted/flag.js` — extend `hostedConfig()` to also expose a `turnstileSiteKey` field? **Decision: NO.** Keep `hostedConfig()` server-secret-facing and add a separate `publicHostedConfig()` helper. Public-safe fields only.

**Never touch:** `app/lib/doctor/generated/**`, `graphify-pilot/**`, `public/downloads/dashclaw-platform-intelligence*`.

---

### Task 1: Stack template module (`app/connect/hostedTemplates.js`)

**Files:**
- Create: `app/connect/hostedTemplates.js`
- Create test: `__tests__/unit/hosted/hosted-templates.test.js`

**Why:** Pure functions are trivially testable and reusable if Plan 3's installer packages later want to generate the same snippets server-side.

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/hosted/hosted-templates.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import {
  STACK_OPTIONS,
  renderTemplate,
} from '../../../app/connect/hostedTemplates.js';

const SAMPLE = {
  endpoint: 'https://hosted.example.com',
  apiKey: 'oc_live_abc123def456',
  workspaceId: 'org_xyz789',
};

describe('hostedTemplates', () => {
  it('exposes 5 stack options with id, label, description', () => {
    expect(STACK_OPTIONS).toHaveLength(5);
    const ids = STACK_OPTIONS.map((s) => s.id);
    expect(ids).toEqual(['claude-code', 'openclaw', 'codex', 'langchain', 'mcp']);
    for (const opt of STACK_OPTIONS) {
      expect(opt.id).toBeTruthy();
      expect(opt.label).toBeTruthy();
      expect(opt.description).toBeTruthy();
    }
  });

  it('renders a JSON hook config for claude-code', () => {
    const { language, code } = renderTemplate('claude-code', SAMPLE);
    expect(language).toBe('json');
    expect(code).toContain('https://hosted.example.com');
    expect(code).toContain('oc_live_abc123def456');
    expect(code).toContain('DASHCLAW_URL');
    expect(code).toContain('DASHCLAW_API_KEY');
  });

  it('renders an install-plus-env snippet for openclaw', () => {
    const { language, code } = renderTemplate('openclaw', SAMPLE);
    expect(language).toBe('bash');
    expect(code).toContain('@dashclaw/openclaw-plugin');
    expect(code).toContain('oc_live_abc123def456');
    expect(code).toContain('https://hosted.example.com');
  });

  it('renders a JSON config for codex', () => {
    const { language, code } = renderTemplate('codex', SAMPLE);
    expect(language).toBe('json');
    expect(code).toContain('oc_live_abc123def456');
    expect(code).toContain('https://hosted.example.com');
  });

  it('renders a Python snippet for langchain', () => {
    const { language, code } = renderTemplate('langchain', SAMPLE);
    expect(language).toBe('python');
    expect(code).toContain('DASHCLAW_URL');
    expect(code).toContain('DASHCLAW_API_KEY');
    expect(code).toContain('oc_live_abc123def456');
    expect(code).toContain('https://hosted.example.com');
  });

  it('renders an MCP server config for mcp', () => {
    const { language, code } = renderTemplate('mcp', SAMPLE);
    expect(language).toBe('json');
    expect(code).toContain('@dashclaw/mcp-server');
    expect(code).toContain('oc_live_abc123def456');
    expect(code).toContain('https://hosted.example.com');
  });

  it('throws on unknown stack id', () => {
    expect(() => renderTemplate('nope', SAMPLE)).toThrow(/unknown stack/i);
  });

  it('never emits undefined/null literals in substituted output', () => {
    for (const opt of STACK_OPTIONS) {
      const { code } = renderTemplate(opt.id, SAMPLE);
      expect(code).not.toMatch(/undefined/);
      expect(code).not.toMatch(/\bnull\b/);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run __tests__/unit/hosted/hosted-templates.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `app/connect/hostedTemplates.js`**

```javascript
// Pure template functions for rendering per-stack integration snippets.
// Given a provisioning result (endpoint, apiKey, workspaceId), returns
// { language, code } the UI renders as a copy-paste block.

export const STACK_OPTIONS = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    description: 'PreToolUse / PostToolUse hooks wired into your Claude Code settings.',
  },
  {
    id: 'openclaw',
    label: 'OpenClaw',
    description: 'Framework-native plugin that handles guard + record + waitForApproval automatically.',
  },
  {
    id: 'codex',
    label: 'Codex',
    description: 'Drop-in hook config for OpenAI Codex CLI.',
  },
  {
    id: 'langchain',
    label: 'LangChain',
    description: 'Python initializer that wraps your chain with DashClaw governance.',
  },
  {
    id: 'mcp',
    label: 'MCP Server',
    description: 'Zero-code option for Claude Code, Claude Desktop, or any MCP host.',
  },
];

function claudeCode({ endpoint, apiKey }) {
  return `{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash|Edit|Write|MultiEdit",
      "hooks": [{
        "type": "command",
        "command": "npx @dashclaw/claude-code-hook"
      }]
    }]
  },
  "env": {
    "DASHCLAW_URL": "${endpoint}",
    "DASHCLAW_API_KEY": "${apiKey}"
  }
}`;
}

function openclaw({ endpoint, apiKey }) {
  return `# One-shot install for Claude Code + OpenClaw plugin:
DASHCLAW_URL="${endpoint}" \\
DASHCLAW_API_KEY="${apiKey}" \\
npx @dashclaw/openclaw-plugin@latest install`;
}

function codex({ endpoint, apiKey }) {
  return `{
  "governance": {
    "provider": "dashclaw",
    "endpoint": "${endpoint}",
    "api_key": "${apiKey}",
    "hooks": ["pre_tool_use", "post_tool_use"]
  }
}`;
}

function langchain({ endpoint, apiKey }) {
  return `# pip install dashclaw
import os
from dashclaw import DashclawClient

os.environ["DASHCLAW_URL"] = "${endpoint}"
os.environ["DASHCLAW_API_KEY"] = "${apiKey}"

client = DashclawClient()
# Wrap each tool call:
#   decision = client.guard(agent_id="my-agent", action_type="...", ...)
#   if decision.allow: ... ; client.record_outcome(...)`;
}

function mcp({ endpoint, apiKey }) {
  return `{
  "mcpServers": {
    "dashclaw": {
      "command": "npx",
      "args": ["@dashclaw/mcp-server"],
      "env": {
        "DASHCLAW_URL": "${endpoint}",
        "DASHCLAW_API_KEY": "${apiKey}"
      }
    }
  }
}`;
}

const RENDERERS = {
  'claude-code': { language: 'json', fn: claudeCode },
  openclaw: { language: 'bash', fn: openclaw },
  codex: { language: 'json', fn: codex },
  langchain: { language: 'python', fn: langchain },
  mcp: { language: 'json', fn: mcp },
};

export function renderTemplate(stackId, { endpoint, apiKey, workspaceId }) {
  const entry = RENDERERS[stackId];
  if (!entry) throw new Error(`unknown stack: ${stackId}`);
  return {
    language: entry.language,
    code: entry.fn({ endpoint, apiKey, workspaceId }),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run __tests__/unit/hosted/hosted-templates.test.js`
Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/connect/hostedTemplates.js __tests__/unit/hosted/hosted-templates.test.js
git commit -m "feat(hosted-ui): add per-stack template renderers"
```

---

### Task 2: Public hosted config helper (`app/lib/hosted/publicConfig.js`)

**Files:**
- Create: `app/lib/hosted/publicConfig.js`
- Create test: `__tests__/unit/hosted/publicConfig.test.js`

**Why:** Need a single source of truth for the public-safe fields the client component receives from the server. Keeping secrets (like `TURNSTILE_SECRET_KEY`) out of this helper prevents accidental leakage if a future server component serializes everything.

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/hosted/publicConfig.test.js`:

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { publicHostedConfig } from '../../../app/lib/hosted/publicConfig.js';

describe('publicHostedConfig', () => {
  const original = { ...process.env };
  beforeEach(() => { process.env = { ...original }; });
  afterEach(() => { process.env = { ...original }; });

  it('returns hostedMode=false when DASHCLAW_HOSTED unset', () => {
    delete process.env.DASHCLAW_HOSTED;
    expect(publicHostedConfig()).toEqual({ hostedMode: false, turnstileSiteKey: null });
  });

  it('returns hostedMode=true when DASHCLAW_HOSTED=true', () => {
    process.env.DASHCLAW_HOSTED = 'true';
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    expect(publicHostedConfig()).toEqual({ hostedMode: true, turnstileSiteKey: null });
  });

  it('includes turnstileSiteKey when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set', () => {
    process.env.DASHCLAW_HOSTED = 'true';
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'site-key-abc';
    expect(publicHostedConfig()).toEqual({ hostedMode: true, turnstileSiteKey: 'site-key-abc' });
  });

  it('never exposes TURNSTILE_SECRET_KEY', () => {
    process.env.DASHCLAW_HOSTED = 'true';
    process.env.TURNSTILE_SECRET_KEY = 'secret-must-not-leak';
    const config = publicHostedConfig();
    expect(JSON.stringify(config)).not.toContain('secret-must-not-leak');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run __tests__/unit/hosted/publicConfig.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `app/lib/hosted/publicConfig.js`**

```javascript
// Public-safe subset of hosted config. Safe to serialize to client components.
// Never include secrets (TURNSTILE_SECRET_KEY, HOSTED_CLEANUP_SECRET, etc.).

export function publicHostedConfig() {
  const hostedMode = process.env.DASHCLAW_HOSTED === 'true';
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null;
  return { hostedMode, turnstileSiteKey };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run __tests__/unit/hosted/publicConfig.test.js`
Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/hosted/publicConfig.js __tests__/unit/hosted/publicConfig.test.js
git commit -m "feat(hosted-ui): add public-safe hosted config helper"
```

---

### Task 3: Client component — stack picker + provisioning (`app/connect/HostedProvisionClient.js`)

**Files:**
- Create: `app/connect/HostedProvisionClient.js`
- Create test: `__tests__/unit/hosted/hosted-provision-client.test.js`

**Why:** This is where the interactive state lives. Picker selection, fetch to `/api/hosted/workspaces`, loading state, error state, success state with templated config + copy button.

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/hosted/hosted-provision-client.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import HostedProvisionClient from '../../../app/connect/HostedProvisionClient.js';

describe('HostedProvisionClient', () => {
  beforeEach(() => {
    // jsdom polyfill: clipboard API
    if (!navigator.clipboard) {
      Object.assign(navigator, { clipboard: { writeText: vi.fn(() => Promise.resolve()) } });
    } else {
      vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    }
    vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the 5 stack options with the first pre-selected', () => {
    render(<HostedProvisionClient turnstileSiteKey={null} />);
    expect(screen.getByRole('radio', { name: /claude code/i })).toBeChecked();
    for (const label of [/openclaw/i, /codex/i, /langchain/i, /mcp server/i]) {
      expect(screen.getByRole('radio', { name: label })).not.toBeChecked();
    }
  });

  it('switches the selected stack when user clicks another option', () => {
    render(<HostedProvisionClient turnstileSiteKey={null} />);
    fireEvent.click(screen.getByRole('radio', { name: /langchain/i }));
    expect(screen.getByRole('radio', { name: /langchain/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /claude code/i })).not.toBeChecked();
  });

  it('fires provisioning on button click and shows the templated config on success', async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        workspace_id: 'org_abc',
        api_key: 'oc_live_test123',
        endpoint: 'https://hosted.example.com',
        expires_at: '2026-05-18T00:00:00Z',
        trial_action_cap: 10000,
      }),
    });
    render(<HostedProvisionClient turnstileSiteKey={null} />);
    fireEvent.click(screen.getByRole('button', { name: /mint trial/i }));
    await waitFor(() => {
      expect(screen.getByText(/oc_live_test123/)).toBeInTheDocument();
    });
    expect(screen.getByText(/org_abc/)).toBeInTheDocument();
    expect(screen.getByText(/DASHCLAW_URL/)).toBeInTheDocument();
  });

  it('displays an error when provisioning fails', async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: 'Rate limit exceeded' }),
    });
    render(<HostedProvisionClient turnstileSiteKey={null} />);
    fireEvent.click(screen.getByRole('button', { name: /mint trial/i }));
    await waitFor(() => {
      expect(screen.getByText(/rate limit/i)).toBeInTheDocument();
    });
  });

  it('disables the button while loading', async () => {
    let resolveFetch;
    globalThis.fetch.mockImplementationOnce(() => new Promise((resolve) => { resolveFetch = resolve; }));
    render(<HostedProvisionClient turnstileSiteKey={null} />);
    const btn = screen.getByRole('button', { name: /mint trial/i });
    fireEvent.click(btn);
    expect(btn).toBeDisabled();
    resolveFetch({
      ok: true,
      status: 200,
      json: async () => ({
        workspace_id: 'org_x', api_key: 'oc_live_x', endpoint: 'https://h.example',
        expires_at: '2099-01-01T00:00:00Z', trial_action_cap: 10000,
      }),
    });
    await waitFor(() => {
      expect(screen.getByText(/oc_live_x/)).toBeInTheDocument();
    });
  });

  it('copies the templated config when copy button is clicked', async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        workspace_id: 'org_abc', api_key: 'oc_live_test',
        endpoint: 'https://hosted.example.com',
        expires_at: '2099-01-01T00:00:00Z', trial_action_cap: 10000,
      }),
    });
    render(<HostedProvisionClient turnstileSiteKey={null} />);
    fireEvent.click(screen.getByRole('button', { name: /mint trial/i }));
    await waitFor(() => screen.getByText(/oc_live_test/));
    fireEvent.click(screen.getByRole('button', { name: /copy config/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    const copied = navigator.clipboard.writeText.mock.calls[0][0];
    expect(copied).toContain('oc_live_test');
    expect(copied).toContain('https://hosted.example.com');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run __tests__/unit/hosted/hosted-provision-client.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `app/connect/HostedProvisionClient.js`**

```javascript
'use client';

import { useState } from 'react';
import { Check, Copy, AlertCircle, Sparkles } from 'lucide-react';
import { STACK_OPTIONS, renderTemplate } from './hostedTemplates.js';

function CopyButton({ value, label = 'Copy config' }) {
  const [copied, setCopied] = useState(false);
  async function onClick() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-tertiary px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary"
    >
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
      {copied ? 'Copied' : label}
    </button>
  );
}

export default function HostedProvisionClient({ turnstileSiteKey }) {
  const [selected, setSelected] = useState('claude-code');
  const [state, setState] = useState({ status: 'idle' });

  async function onMint() {
    setState({ status: 'loading' });
    try {
      // Turnstile token collection is handled via DOM widget when site key is set;
      // the hidden input name 'cf-turnstile-response' is auto-populated by the widget.
      const form = document.getElementById('dashclaw-turnstile-form');
      const turnstileToken = form ? new FormData(form).get('cf-turnstile-response') || '' : '';
      const res = await fetch('/api/hosted/workspaces', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ turnstile_token: turnstileToken }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setState({ status: 'error', error: body.error || `HTTP ${res.status}` });
        return;
      }
      const body = await res.json();
      setState({ status: 'success', data: body });
    } catch (err) {
      setState({ status: 'error', error: err.message || 'Network error' });
    }
  }

  const selectedOption = STACK_OPTIONS.find((s) => s.id === selected);
  const rendered = state.status === 'success' ? renderTemplate(selected, {
    endpoint: state.data.endpoint,
    apiKey: state.data.api_key,
    workspaceId: state.data.workspace_id,
  }) : null;

  return (
    <div className="space-y-6">
      <form id="dashclaw-turnstile-form" onSubmit={(e) => e.preventDefault()}>
        <fieldset>
          <legend className="sr-only">Choose your agent stack</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {STACK_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className={`flex cursor-pointer flex-col gap-1 rounded-2xl border p-4 transition-colors ${
                  selected === opt.id
                    ? 'border-brand bg-surface-tertiary'
                    : 'border-border bg-surface-tertiary hover:border-border-hover'
                }`}
              >
                <input
                  type="radio"
                  name="stack"
                  value={opt.id}
                  checked={selected === opt.id}
                  onChange={() => setSelected(opt.id)}
                  className="sr-only"
                />
                <span className="text-sm font-semibold text-text-primary">{opt.label}</span>
                <span className="text-xs text-text-tertiary">{opt.description}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {turnstileSiteKey ? (
          <div className="mt-4">
            <div className="cf-turnstile" data-sitekey={turnstileSiteKey} data-theme="dark" />
          </div>
        ) : null}
      </form>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMint}
          disabled={state.status === 'loading'}
          className="inline-flex items-center gap-2 rounded-full border border-brand bg-brand/10 px-5 py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-brand/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Sparkles size={14} />
          {state.status === 'loading' ? 'Minting...' : `Mint trial workspace for ${selectedOption.label}`}
        </button>
        {state.status === 'error' ? (
          <div className="flex items-center gap-1.5 text-xs text-status-error">
            <AlertCircle size={12} />
            <span>{state.error}</span>
          </div>
        ) : null}
      </div>

      {state.status === 'success' ? (
        <div className="space-y-4 rounded-2xl border border-border bg-surface-tertiary p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-tertiary">Trial workspace</p>
              <p className="mt-1 font-mono text-sm text-text-primary">{state.data.workspace_id}</p>
              <p className="mt-0.5 text-xs text-text-tertiary">
                Expires <time dateTime={state.data.expires_at}>{new Date(state.data.expires_at).toLocaleDateString()}</time> · cap {state.data.trial_action_cap.toLocaleString()} actions
              </p>
            </div>
            <span className="rounded-full border border-brand/30 bg-brand/10 px-2.5 py-0.5 text-[11px] font-medium text-brand">
              Save this API key now — it won&rsquo;t be shown again
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                Config for {selectedOption.label} ({rendered.language})
              </p>
              <CopyButton value={rendered.code} />
            </div>
            <pre className="mt-2 overflow-x-auto rounded-xl border border-border bg-surface-primary p-4 text-xs leading-relaxed text-text-secondary">
              {rendered.code}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- --run __tests__/unit/hosted/hosted-provision-client.test.js`
Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/connect/HostedProvisionClient.js __tests__/unit/hosted/hosted-provision-client.test.js
git commit -m "feat(hosted-ui): add stack-picker client component with provisioning flow"
```

---

### Task 4: Server section component (`app/connect/HostedProvisionSection.js`)

**Files:**
- Create: `app/connect/HostedProvisionSection.js`

**Why:** The outer card + title + description + Turnstile script injection. Gated on `publicHostedConfig().hostedMode`. No client directive — it mounts the client component inside.

- [ ] **Step 1: Implement the section**

Create `app/connect/HostedProvisionSection.js`:

```javascript
import Script from 'next/script';
import { publicHostedConfig } from '../lib/hosted/publicConfig.js';
import HostedProvisionClient from './HostedProvisionClient.js';

export default function HostedProvisionSection() {
  const { hostedMode, turnstileSiteKey } = publicHostedConfig();
  if (!hostedMode) return null;

  return (
    <>
      {turnstileSiteKey ? (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="afterInteractive"
          async
          defer
        />
      ) : null}
      <section className="rounded-3xl border border-brand/30 bg-surface-secondary p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-tertiary">
            Try it hosted
          </p>
          <span className="rounded-full border border-brand/20 bg-brand/10 px-2.5 py-0.5 text-[11px] font-medium text-brand">
            30-second trial · no install
          </span>
        </div>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-text-primary">
          Pick your stack, get a pre-configured workspace
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">
          We mint a time-boxed DashClaw workspace and hand back a drop-in config for your agent stack. No account, no credit card — the trial runs for 30 days or 10,000 governed actions.
        </p>
        <div className="mt-6">
          <HostedProvisionClient turnstileSiteKey={turnstileSiteKey} />
        </div>
      </section>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/connect/HostedProvisionSection.js
git commit -m "feat(hosted-ui): add flag-gated section wrapper on /connect"
```

---

### Task 5: Wire the section into `/connect/page.js`

**Files:**
- Modify: `app/connect/page.js`

**Why:** Render the new section above the existing MCP Server section. When `DASHCLAW_HOSTED` is unset, it renders nothing and the page is unchanged.

- [ ] **Step 1: Read `app/connect/page.js`**

Confirm the import block and the `<main>` structure. The new section must be the FIRST child inside `<div className="mx-auto max-w-5xl">` after the breadcrumb, so that hosted visitors see it first.

- [ ] **Step 2: Modify `app/connect/page.js`**

Add the import at the top of the file:

```javascript
import HostedProvisionSection from './HostedProvisionSection';
```

Insert `<HostedProvisionSection />` directly BEFORE `<ConnectGuideClient content={content} />`. The final structure inside `<div className="mx-auto max-w-5xl">`:

```jsx
<div className="mb-8 flex items-center gap-2 text-sm text-text-tertiary">
  ...breadcrumb...
</div>

<HostedProvisionSection />

<ConnectGuideClient content={content} />

{/* ...rest unchanged... */}
```

If `HostedProvisionSection` returns `null` (self-host), the layout is identical to before. When it renders, the existing sections naturally flow below it with their `mt-6` / `mt-12` spacing.

- [ ] **Step 3: Verify page renders in dev (manual sanity check not required for the plan)**

Run: `npm run test -- --run __tests__/unit/hosted/` — full hosted suite should still pass (the new imports shouldn't break any existing test).

Expected: 40+ existing hosted tests + new tests from Tasks 1-3 all pass.

- [ ] **Step 4: Commit**

```bash
git add app/connect/page.js
git commit -m "feat(hosted-ui): mount hosted provision section on /connect"
```

---

### Task 6: Env var + docs

**Files:**
- Modify: `.env.example`
- Modify: `PROJECT_DETAILS.md`

**Why:** `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is a new public-safe env var. The SDK Documentation Checklist also requires a one-line note in `PROJECT_DETAILS.md` when user-facing surfaces change.

- [ ] **Step 1: Add env var to `.env.example`**

Open `.env.example` and find the existing "OPTIONAL: Hosted provisioning" section (added in Plan 1). Add one line to it:

```bash
# NEXT_PUBLIC_TURNSTILE_SITE_KEY=               # Client-side Turnstile widget site key (pairs with TURNSTILE_SECRET_KEY)
```

Place it immediately after the `TURNSTILE_SECRET_KEY` line so the pair is visually adjacent.

- [ ] **Step 2: Update `PROJECT_DETAILS.md`**

Find the Essential UI Surfaces table (or the `/connect` row). Add a parenthetical note at the end of the `/connect` description:

```markdown
| Connect | `/connect` | The 8-minute path to first governed action. When `DASHCLAW_HOSTED=true`, prepends a stack-picker + trial-provisioning flow. |
```

If the table has been restructured since the plan was written, match the existing format.

- [ ] **Step 3: Run doc validators**

Run: `npm run docs:check`
Expected: exit 0.

Run: `npm run openapi:check && npm run api:inventory:check`
Expected: exit 0 (no API changes).

- [ ] **Step 4: Commit**

```bash
git add .env.example PROJECT_DETAILS.md
git commit -m "docs(hosted-ui): note Turnstile site key + /connect flow extension"
```

---

### Task 7: Final verification

**Files:** no changes — gate before declaring the plan complete.

- [ ] **Step 1: Full test suite**

Run: `npm run test -- --run`
Expected: all tests PASS (previous count + ~15 new hosted-ui tests). **Do not proceed if any test fails** — fix and re-run before continuing.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: exit 0.

- [ ] **Step 3: Route-SQL guardrail (sanity)**

Run: `npm run route-sql:check`
Expected: exit 0. No new routes were added, so the baseline should be unchanged.

- [ ] **Step 4: Dev-server smoke check (manual, flagged for user)**

Document in the final report what the user should manually verify:

```bash
# 1. Section hidden by default (self-host path)
npm run dev
# Visit http://localhost:3000/connect — should NOT show "Try it hosted"

# 2. Section visible + functional with flag on
DASHCLAW_HOSTED=true npm run dev
# Visit http://localhost:3000/connect
# - "Try it hosted" section appears at the top
# - Pick a stack, click "Mint trial workspace"
# - Config appears with real endpoint + api_key
# - Copy button copies the config
```

The plan does not require running the dev server from the subagent session — flag these for the user to run manually per the "no Chrome DevTools MCP" rule.

- [ ] **Step 5: Final commit only if cleanup is needed**

```bash
git status
# If clean, nothing to commit.
```

---

## Self-Review

**Spec coverage:**
- Stack picker UI ✓ (Task 3)
- Per-stack installer templates ✓ (Task 1, inline template functions)
- Provisioning fetch wired to Plan 1 endpoint ✓ (Task 3)
- Turnstile widget integration ✓ (Tasks 2, 4)
- Flag-gated server rendering ✓ (Tasks 2, 4)
- `/connect` integration ✓ (Task 5)
- Docs + env var ✓ (Task 6)
- Full-suite verification ✓ (Task 7)

**Placeholder scan:** None — every task has complete code or a complete file path + exact command.

**Type consistency:** `STACK_OPTIONS` shape `{id, label, description}` is consistent across Tasks 1 and 3. `renderTemplate(stackId, {endpoint, apiKey, workspaceId})` signature is used identically. The provisioning response shape (`workspace_id`, `api_key`, `endpoint`, `expires_at`, `trial_action_cap`) matches Plan 1's route return (verified against `app/api/hosted/workspaces/route.js`).

**Memory constraints honored:**
- No PRs — each task commits to main ✓
- Design tokens only (no hex) — verified in all JSX samples ✓
- Brand orange as signal (primary CTA + "save this key" warning only, never decoration) ✓
- `lucide-react` for icons ✓
- No new LLM key flow anywhere ✓
- SDK Documentation Checklist observed for the new env var ✓

---

## Open questions / follow-ups (not blocking)

1. **Turnstile script injection location**: currently in `HostedProvisionSection` via `next/script`. If we move hosted to its own route (`/try`) later, the script should scope there instead of leaking into every `/connect` render. Fine for Plan 2.
2. **Copy-button accessibility**: `aria-live` region for "Copied" state would be more accessible. Minor — can address if a11y audit flags it.
3. **Trial "next steps" deep link**: Plan 1's route returns `next_steps_url` but Plan 2 doesn't use it. When Plan 3 ships installer packages with a verify-back-ping, we can add a "Verify connection" status indicator driven by that URL.
4. **Dark-mode-only Turnstile theme**: hardcoded `data-theme="dark"` matches `.impeccable.md`. If light mode ever ships, add a dynamic theme prop.
