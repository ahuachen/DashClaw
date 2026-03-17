# Codebase Concerns

**Analysis Date:** 2026-03-17

## Tech Debt

**Database Connection Pooling in Development:**
- Issue: HMR (hot module reload) in Next.js dev mode creates new connection pools without closing old ones, exhausting `max_connections`.
- Files: `app/lib/db.js` (lines 6-11)
- Impact: Dev mode becomes unstable after multiple file changes; connection timeouts and "too many connections" errors.
- Fix approach: Uses `globalThis` singleton to survive HMR reloads. Current implementation is correct but fragile; monitor for edge cases where singleton breaks (e.g., certain Next.js versions or dev server restarts).

**Large Repository Files:**
- Issue: Core business logic concentrated in single files rather than split by domain.
- Files:
  - `app/lib/repositories/actions.repository.js` (545 lines) - all action CRUD operations
  - `app/lib/repositories/learningLoop.repository.js` (432 lines) - loop lifecycle
  - `app/lib/guard.js` (463 lines) - policy evaluation engine
- Impact: Difficult to navigate, test in isolation, and modify risk-critical guard logic safely.
- Fix approach: Split by operation type (e.g., `actions-create.js`, `actions-query.js`, `actions-update.js`) or by guard evaluation concerns (`guard-policy-match.js`, `guard-risk-score.js`). Test coverage should accompany splitting.

**Incomplete Pytest Generator:**
- Issue: Guardrail generator for Python is a stub returning TODO comment.
- Files: `app/lib/guardrails/generators/pytest.js` (line 13)
- Impact: Python teams cannot auto-generate test guardrails; breaks parity with JavaScript generation.
- Fix approach: Implement pytest-compatible guardrail generation, matching JavaScript generator output structure.

**Policy Validation via Exception String Matching:**
- Issue: Policy uniqueness constraint detected by catching `err.message.includes('guard_policies_org_name_unique')` rather than error code/type.
- Files: `app/api/policies/route.js` (line 85)
- Impact: Fragile to database driver changes; if error message format changes, constraint handling breaks silently.
- Fix approach: Switch to error code matching (e.g., `err.code === 'UNIQUE_VIOLATION'`) or explicit conflict detection query before insert.

**Archived Routes Not Removed:**
- Issue: 48 archived route files (259KB) remain in `app/api/_archive/` (e.g., workflows, messaging, memory, routing agents, bounties).
- Files: `app/api/_archive/` (48 files)
- Impact: Code duplication, confusion about platform scope, increased bundle analysis time, legacy patterns leak into new features.
- Fix approach: Remove archived routes after 2 releases or when no production traffic remains. Create migration guide for users.

## Known Bugs

**SSE Stream Writer Deadlock Risk:**
- Symptoms: Server-sent events connections hang or fail to flush during high concurrency.
- Files: `app/api/stream/route.js` (lines 24-43)
- Trigger: Multiple concurrent SSE clients with backpressure on writer. Awaiting writer writes before returning Response can deadlock.
- Workaround: Code uses `queueMicrotask(() => void startPump())` (line 166) to avoid awaiting writes in synchronous path. This is correct but requires careful maintenance—any refactor that awaits writes in the Response path will reintroduce deadlock.

**JSON Parsing Silent Failures in Policy Filtering:**
- Symptoms: Policies with malformed `agent_ids` JSON silently default to "applies to all agents" rather than erroring.
- Files: `app/api/policies/route.js` (lines 31-35), `app/lib/guard.js` (lines 93-97)
- Trigger: Corrupted or manually edited policy records with invalid JSON in `agent_ids` column.
- Workaround: None; malformed policies operate permissively. Data corruption goes unnoticed.

**Realtime Backend Fallback to Memory in Production:**
- Symptoms: If REDIS_URL is unset, system silently uses in-memory EventEmitter instead of persistent Redis, losing all events on restart.
- Files: `app/lib/events.js` (lines 23-26)
- Trigger: Missing `REDIS_URL` environment variable; code does not require it.
- Workaround: Explicitly set `REALTIME_ENFORCE_REDIS=true` to force Redis and fail on missing credentials. Otherwise, production instances will lose event history on deploy/restart without warning.

## Security Considerations

**Secrets in Integration Health Checks:**
- Risk: Health checkers make live API calls with user credentials (OpenAI, Anthropic, Slack, Linear, GitHub, Stripe keys).
- Files: `app/lib/integration-health.js` (lines 20-120)
- Current mitigation: Health checks use HTTPS; credentials decrypted in-memory; no logging of request/response bodies. Timeout is 8 seconds to limit exposure window.
- Recommendations: (1) Add request logging toggle to suppress credential transmission in logs, (2) Cache health results for 60+ seconds to reduce frequency of credential use, (3) Document health check limitations in security policy.

**Demo Mode Cookie Domain Scope:**
- Risk: Demo mode cookie could be accepted on self-hosted instances, creating confusion and accidental data exposure.
- Files: `app/lib/isDemoMode.js` (line 10)
- Current mitigation: Demo cookie only honored on `dashclaw.io` domain; self-hosted instances ignore it.
- Recommendations: Hard-code DEMO_MODE env var requirement for non-dashclaw.io domains; reject demo cookie override on localhost/self-hosted.

**Encryption Key Length Validation:**
- Risk: Weak ENCRYPTION_KEY values could be accepted if validation is bypassed.
- Files: `app/lib/encryption.js` (lines 17-20)
- Current mitigation: Enforces exactly 32 bytes (ASCII); rejects multibyte UTF-8 interpretations. Backward-compatible CBC support for key rotation.
- Recommendations: (1) Rotate legacy CBC ciphertexts to GCM format on read, (2) Add optional keyring for multi-key rotation without downtime, (3) Enforce key age in production (warn on keys older than 90 days).

**SSRF Protection Allowlist Not Enforced:**
- Risk: Webhook validation mentions optional ALLOWLIST but doesn't enforce it globally.
- Files: `app/lib/validate.js` (lines 312-367), `app/lib/webhooks.js` (lines 116, 193)
- Current mitigation: Manual domain checks via `validateWebhookUrl()` called in routes; `redirect: 'manual'` prevents follow-on-redirect SSRF.
- Recommendations: (1) Make allowlist mandatory and env-var controlled, (2) Test webhook validation against common SSRF bypass patterns (e.g., IPv6, CNAME shadowing), (3) Add metrics on blocked webhook attempts.

**Prompt Injection Detection Not Enforced:**
- Risk: Prompt injection patterns detected but not blocked—only flagged.
- Files: `app/lib/promptInjection.js`, `app/api/security/prompt-injection/route.js`
- Current mitigation: Patterns detected (instruction smuggling, jailbreak attempts, role hijacking); no automatic blocking, admin review only.
- Recommendations: (1) Auto-block HIGH severity patterns unless explicitly overridden, (2) Add audit log for injection attempts, (3) Implement LLM-based semantic detection as secondary layer.

## Performance Bottlenecks

**SSE Event Replay Buffer Memory Unbounded in High-Traffic Orgs:**
- Problem: Memory backend stores events in-memory without automatic cleanup. High-traffic orgs with many concurrent SSE connections will accumulate events.
- Files: `app/lib/events.js` (lines 64-75, 82-85)
- Cause: `replayByOrg` Map grows until org events age past `REALTIME_REPLAY_WINDOW_SECONDS` (default 600s, configurable). Pruning happens on every publish but not on subscribe.
- Improvement path: (1) Switch to Redis for all environments (remove memory backend), (2) Add background pruning job independent of publish calls, (3) Implement org-level replay buffer quota with eviction policy.

**Guard Policy Evaluation N+1 on Agent-Scoped Policies:**
- Problem: Every policy's `agent_ids` JSON is parsed twice—once in GET filter, once in evaluateGuard.
- Files: `app/api/policies/route.js` (lines 31-35), `app/lib/guard.js` (lines 91-98)
- Cause: Policies store scope as JSON string; filtering requires parsing, then guard evaluation parses again.
- Improvement path: (1) Index policies on (org_id, agent_id) and normalize schema (store agent_id references separately), (2) Cache parsed agent_ids in memory with TTL, (3) Precompute policy applicability bitmask on agent heartbeat.

**Integration Health Checks Run Sequentially Per Org:**
- Problem: `/api/cron/integration-health` checks all providers for all agents sequentially; scales poorly.
- Files: `app/lib/integration-health.js`, `app/api/cron/integration-health/route.js`
- Cause: No concurrency limits; single slow provider blocks all others.
- Improvement path: (1) Parallel Promise.all with concurrency limit (e.g., 5 concurrent checks), (2) Cache per-provider checks across agents, (3) Skip redundant checks if same key already verified in last 60 minutes.

## Fragile Areas

**JSON Parsing in guard.js Policy Agent Scoping:**
- Files: `app/lib/guard.js` (lines 91-98)
- Why fragile: Wraps JSON.parse in try-catch that silently returns true (applies to all agents) on any parse error. Malformed data in database becomes silent failure.
- Safe modification: (1) Log parse errors to console.error, (2) Validate agent_ids on policy insert/update, (3) Add database integrity check script to find malformed records.
- Test coverage: No tests for malformed agent_ids JSON case.

**SSE Stream Writer Lifecycle:**
- Files: `app/api/stream/route.js` (lines 24-43, 143-149)
- Why fragile: Multiple cleanup mechanisms (client abort, heartbeat timeout, max duration) must coordinate without race conditions. `isClosed` flag is the synchronization point.
- Safe modification: Never remove or refactor the isClosed check. Always call cleanup() instead of closing writer directly. Add integration tests for concurrent cleanup triggers.
- Test coverage: Unit tests exist but don't cover concurrent cleanup scenarios.

**Policy Rule Validation in PATCH:**
- Files: `app/api/policies/route.js` (lines 124-137)
- Why fragile: Validation requires fetching existing policy first, then validating updated rules. If policy deleted between fetch and validation, update silently fails.
- Safe modification: Use a SELECT FOR UPDATE or transaction for atomic fetch-validate-update.
- Test coverage: No tests for concurrent PATCH on same policy.

**Encryption Key Rotation Not Supported:**
- Files: `app/lib/encryption.js`
- Why fragile: Single ENCRYPTION_KEY in env var. No mechanism to rotate without decrypting all data, changing key, re-encrypting. Any key compromise requires full rekey.
- Safe modification: Implement keyring with key version identifiers in ciphertext. PATCH migrations to re-encrypt all data with new key.
- Test coverage: Backward compatibility tests exist but no rotation scenario tests.

**Real-time Backend Fallback (Memory vs Redis):**
- Files: `app/lib/events.js` (lines 23-26, 138-241)
- Why fragile: Automatic fallback from Redis to memory backend if REDIS_URL missing. In production, this silently degrades to non-persistent event storage.
- Safe modification: Require explicit opt-in for memory backend via env var. Fail hard if Redis required but unavailable.
- Test coverage: Tests exist for memory backend; Redis backend tests skipped if REDIS_URL absent.

## Scaling Limits

**Database Connection Pool:**
- Current capacity: 10 connections (hardcoded default in `app/lib/db.js` line 74, configurable via `DASHCLAW_DB_POOL_MAX`).
- Limit: With 10 connections and 50ms query latency, max throughput is ~200 requests/sec. Beyond that, connection queue blocks.
- Scaling path: (1) Increase pool to 30-50 for high-concurrency workloads, (2) Implement connection pooler (PgBouncer) between app and Neon, (3) Monitor connection utilization; alert if consistently >80% usage.

**Event Replay Buffer:**
- Current capacity: 1000 events per org (configurable via `REALTIME_REPLAY_MAX_EVENTS`), with 600-second TTL (10 minutes).
- Limit: Orgs generating >1000 events/10min (1.7 events/sec) will lose older events. Clients resuming after >10min gap see empty replay.
- Scaling path: Switch to Redis for persistent event log; implement cursor-based pagination to support arbitrary replay windows.

**Policy Evaluation Cache:**
- Current capacity: Policies fetched and parsed on every guard request (no caching).
- Limit: With 100 policies per org and complex rules, guard latency becomes ~50ms per request. Acceptable for now; will exceed SLA if policy count grows 5x.
- Scaling path: (1) Cache parsed policies in memory with policy.updated_at TTL, (2) Invalidate on policy PATCH/DELETE, (3) Periodically refresh cache (e.g., every 30 seconds).

**SSE Connection Limit:**
- Current capacity: EventEmitter max listeners set to 1000 (configurable via `REALTIME_MEMORY_MAX_LISTENERS`).
- Limit: Beyond 1000 concurrent SSE clients per instance, warning logs appear (Node.js EventEmitter default). Performance degrades.
- Scaling path: (1) Distribute SSE traffic across multiple instances with Redis backend, (2) Add load balancer sticky session routing, (3) Monitor connection count; auto-scale when >80% of limit.

## Dependencies at Risk

**Next.js 15 + Turbopack Stability:**
- Risk: Project uses Next.js 15 with experimental Turbopack. Breaking changes in minor releases have caused dev mode issues (HMR, build failures).
- Impact: Dev velocity affected; deployments require careful testing.
- Migration plan: Monitor Next.js 15.x patch releases. If instability persists, consider reverting to Next.js 14 with stable build system. Keep dependencies up to date and run `npm audit` regularly.

**Neon Serverless Client Edge Cases:**
- Risk: `@neondatabase/serverless` is newer than `postgres` driver. Some edge cases (e.g., concurrent subscriptions, large batches) may behave differently.
- Impact: Queries that work locally (postgres driver) may fail in production (Neon).
- Migration plan: Test all new features against Neon in staging. For local dev, use Docker Postgres. Maintain dual driver support as long as feasible.

**Node.js EventEmitter Max Listeners:**
- Risk: SSE implementation relies on EventEmitter with manually set max listeners. Future Node.js versions may change default or remove this setting.
- Impact: Concurrent SSE connection limits may silently change.
- Migration plan: Replace EventEmitter with explicit subscription registry (Map or Set). This decouples from Node.js implementation details.

## Missing Critical Features

**Multi-Key Encryption/Key Rotation:**
- Problem: Cannot rotate ENCRYPTION_KEY without manual decryption/re-encryption of all records. Any key compromise requires downtime.
- Blocks: Secure key rotation for compliance, zero-downtime key updates.
- Priority: High (required for compliance audits)

**Database Integrity Validator:**
- Problem: No tool to detect malformed records (e.g., invalid JSON in agent_ids, schema violations).
- Blocks: Data quality monitoring, safe mass updates.
- Priority: Medium (helpful for operational confidence)

**Policy Evaluation Metrics:**
- Problem: No metrics on policy match rates, rule evaluation times, or decision distribution.
- Blocks: Performance tuning, anomaly detection on policy behavior.
- Priority: Medium (useful for large deployments)

## Test Coverage Gaps

**SSE Stream Backpressure and Concurrent Cleanup:**
- What's not tested: Multiple concurrent cleanup triggers (client abort + timeout firing simultaneously) and writer backpressure handling.
- Files: `app/api/stream/route.js`
- Risk: Race conditions in cleanup could leak file descriptors or leave streams open.
- Priority: High (affects reliability)

**Policy Validation and PATCH Race Conditions:**
- What's not tested: Concurrent PATCH operations on same policy; policy deletion between validation and update.
- Files: `app/api/policies/route.js`
- Risk: Silent failures; inconsistent policy state.
- Priority: High (affects correctness)

**Encryption Backward Compatibility (CBC to GCM):**
- What's not tested: Reading CBC ciphertexts and writing GCM ciphertexts in same session; key rotation scenarios.
- Files: `app/lib/encryption.js`
- Risk: Failed decrypts on mixed encryption versions; data loss on key rotation.
- Priority: High (security-critical)

**Integration Health Check Error Handling:**
- What's not tested: Network timeouts, 5xx responses, redirect loops in health checks.
- Files: `app/lib/integration-health.js`
- Risk: Health checks hang or crash on slow APIs; credentials exposed in timeout error logs.
- Priority: Medium (affects monitoring)

**Real-time Backend Fallback (Memory vs Redis):**
- What's not tested: Automatic fallback from Redis to memory when connection fails; event loss on restart with memory backend.
- Files: `app/lib/events.js`
- Risk: Silent data loss in production; no alerting on backend degradation.
- Priority: Medium (affects data integrity)

**Guard Policy Agent Scoping with Malformed agent_ids:**
- What's not tested: Policies with invalid JSON in agent_ids; corrupt database records.
- Files: `app/lib/guard.js`
- Risk: Malformed policies silently apply to all agents instead of failing loudly.
- Priority: Low (requires data corruption, which is rare)

---

*Concerns audit: 2026-03-17*
