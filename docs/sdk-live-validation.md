# SDK Live Validation (`sdk:live`)

The live SDK validation suite runs the full Node.js SDK against a real DashClaw instance, verifying that every SDK method correctly persists and returns data through the actual API layer.

## What it does

- Calls every SDK category (actions, loops, assumptions, signals, dashboard data, handoffs, context threads, snippets, preferences, digest, security scanning, messaging, guard, webhooks, bulk sync)
- Creates real records, reads them back, and asserts field-level correctness
- Tests both the SDK class and the `sendDirectMessage` wrapper from `tools/dashclaw/client.js`
- Validates message type enforcement (valid types accepted, invalid types rejected)

**This suite performs real writes.** It creates test records (prefixed with `sdk-live-test`) in the target instance. Run it against development or staging instances, not production, unless you are comfortable with test data in your org.

## When to run

- **Before publishing a new SDK version** — validates that the SDK and API are in sync
- **After API route changes** — catches field-mapping regressions the offline contract harness cannot detect
- **After database migrations** — confirms the persistence layer still matches SDK expectations
- **During SDK development** — quick feedback loop against a local instance

## Required environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DASHCLAW_API_KEY` | Yes | — | API key for the target instance |
| `DASHCLAW_URL` | No | `http://localhost:3000` | Base URL of the DashClaw instance |
| `DASHCLAW_AGENT_ID` | No | `sdk-live-test-agent` | Agent ID used for test records |

## Running locally

Against a local instance (reads credentials from `.env.local`):

```bash
npm run sdk:live
```

Against a hosted instance:

```bash
DASHCLAW_URL=https://staging.example.com \
  DASHCLAW_API_KEY=oc_live_xxx \
  node scripts/test-sdk-live.mjs
```

Or set all three variables explicitly:

```bash
DASHCLAW_URL=https://staging.example.com \
  DASHCLAW_API_KEY=oc_live_xxx \
  DASHCLAW_AGENT_ID=my-test-agent \
  node scripts/test-sdk-live.mjs
```

## Output

The suite prints a category-by-category pass/fail report, then a summary:

- **Category-level errors** — the entire category failed (connectivity, missing endpoint, schema issue). These are not field-mapping bugs.
- **Failed assertions** — individual field-mapping or value mismatches within a category that otherwise responded.

Exit code is `0` on full pass, `1` on any failure.

## Relationship to other test suites

| Script | What it tests | Requires live instance |
|--------|--------------|----------------------|
| `npm run sdk:integration` | SDK request shape matches contract fixture (offline) | No |
| `npm run sdk:integration:python` | Python SDK contract fixture (offline) | No |
| `npm run sdk:live` | SDK + API + DB round-trip field-mapping (live) | Yes |

The offline suites catch SDK-side regressions without infrastructure. The live suite catches API-side and DB-side regressions that only appear when data flows through the full stack.

## CI integration

This suite is **not** wired into the default PR CI pipeline because it requires live credentials and a running instance. To run it in CI, use the manual GitHub Actions workflow:

```
Actions → "SDK Live Validation" → Run workflow
```

The workflow requires `DASHCLAW_URL` and `DASHCLAW_API_KEY` to be configured as repository secrets. See `.github/workflows/sdk-live.yml`.
