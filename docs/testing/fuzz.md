---
owner: Platform
last-verified: 2026-04-13
doc-type: guide
---

# API Fuzz Testing

`npm run test:fuzz` runs [schemathesis](https://schemathesis.readthedocs.io/) against the critical-stable OpenAPI spec. It auto-generates thousands of requests — valid, edge-case, and adversarial — against every declared endpoint, asserting status codes, response schemas, content types, and required headers.

The goal is to catch the **"random weird bugs"** that manual clicking surfaces: unhandled exceptions (500), schemas that disagree with code, auth bypass, malformed JSON, and missing zero/edge-case handling on inputs like empty strings, huge payloads, unicode, and negative numbers.

## One-time install

```bash
pipx install schemathesis
```

Requires Python 3.8+. Produces two binaries on PATH: `st` (short alias) and `schemathesis`.

## Running

```bash
# Against local dev (default target: http://localhost:3000)
npm run dev                          # in one terminal
DASHCLAW_API_KEY=oc_live_... npm run test:fuzz

# Against staging
DASHCLAW_BASE_URL=https://stage.example.com \
DASHCLAW_API_KEY=oc_live_... \
  npm run test:fuzz

# More thorough run (slower, more cases per endpoint)
npm run test:fuzz -- --max-examples 200 --workers 4
```

Reports land in `.fuzz-report/` (gitignored):
- `events.ndjson` — every request/response pair plus check results
- `junit.xml` — CI-friendly test result output

## What it checks

Schemathesis runs these checks against every response (`--checks all`):

| Check | Catches |
|---|---|
| `not_a_server_error` | 500s — unhandled exceptions, unexpected crashes |
| `status_code_conformance` | Response status not in the spec's declared set |
| `response_schema_conformance` | Response body doesn't match the schema |
| `content_type_conformance` | Content-Type header disagrees with spec |
| `response_headers_conformance` | Required response headers missing |
| `negative_data_rejection` | Invalid input incorrectly accepted |
| `positive_data_acceptance` | Valid input incorrectly rejected |
| `missing_required_header` | Required request header doesn't get 4xx |
| `unsupported_method` | Unsupported HTTP method doesn't get 405 |

## Interpreting failures

Each failed operation prints a **minimal reproducer** — schemathesis shrinks the failing input to the smallest case that still fails. Copy the curl command into your terminal to confirm, then debug.

Common failure patterns in DashClaw routes:
- **500 on empty array/object** — missing null check in a repository method
- **200 but schema violation** — route returns snake_case but spec declares camelCase
- **401 expected but 500** — error handling runs before auth check
- **No 405 on unsupported method** — route file exports `GET` but not `HEAD`; Next.js returns 500 instead of 405

## First-run baseline

On 2026-04-13, the first run against a freshly seeded dev instance:

- **1,112 test cases** across 66 operations (coverage + fuzzing + stateful phases)
- **0 server errors**, **0 schema violations**, **0 content-type mismatches**
- **1 warning**: 66 operations repeatedly 404'd because schemathesis generated random path params (e.g., `/api/orgs/0`) that don't match real resources

That 404 warning is the known ceiling of naive fuzzing. To exercise deeper logic, provide realistic parameter values via a schemathesis config file — see *Reaching core logic* below.

## Reaching core logic (realistic IDs)

Schemathesis supports a config file (`schemathesis.toml` or `.schemathesis/config.yml`) that lets you pin specific parameter values. This is how you get fuzzing past the auth/resource-exists layer and into the actual repository + response code:

```toml
# schemathesis.toml (example — not yet committed)
[operation-parameters]
orgId = "org_default"              # replace with your test org
actionId = "act_ABC123"            # a real action in that org
webhookId = "whk_ABC123"           # a real webhook
```

Generate these IDs from your seeded test DB (`npm run seed:demo` family) and commit the config. Fuzzing will then test real happy paths plus schemathesis's generated edge cases against them.

## Scope

The spec covers **40 stable-maturity paths** (via `maturity === 'stable'` in `scripts/lib/api-route-inventory.mjs`). Beta and experimental routes aren't fuzzed yet — the payoff is lower and their contracts may still be shifting.

To promote a route family to `stable`, add its prefix to `API_MATURITY_RULES.stable` in that file, then:

```bash
npm run openapi:generate       # regenerates the spec
npm run openapi:check          # confirms it's committed
```

## CI integration (future)

Once the first fuzz pass is green, add to CI on PRs that touch `app/api/` or `schema/schema.js`:

```yaml
# .github/workflows/fuzz.yml (template)
- run: pipx install schemathesis
- run: npm run dev &
- run: npx wait-on http://localhost:3000/api/health
- run: DASHCLAW_API_KEY=${{ secrets.DASHCLAW_TEST_API_KEY }} npm run test:fuzz
```

For now, run it locally before merging anything that touches a route handler or schema.
