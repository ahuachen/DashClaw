---
source-of-truth: true
owner: Realtime/Infra Lead
last-verified: 2026-02-13
doc-type: rfc
---

# WS3 M4 Production Cutover Runbook

- Related RFC: `docs/rfcs/platform-convergence.md`
- Related design: `docs/rfcs/2026-02-13-sse-broker-design.md`
- Scope: SSE realtime backend cutover from memory to Redis

## Preconditions

- `REDIS_URL` is provisioned and reachable from runtime.
- App is deployed with WS3 M2/M3 code (`publishOrgEvent`, `subscribeOrgEvents`, replay support).
- `/api/health` exposes `checks.realtime`.

## Cutover Flags

- `REALTIME_BACKEND=redis`
- `REALTIME_ENFORCE_REDIS=true`
- `REALTIME_REPLAY_WINDOW_SECONDS=600` (or your desired value)
- `REALTIME_REPLAY_MAX_EVENTS=1000` (or your desired value)

## Staging Cutover Procedure

1. Deploy with `REALTIME_BACKEND=redis` and `REALTIME_ENFORCE_REDIS=false`.
2. Validate `/api/health`:
   - `checks.realtime.selected_backend=redis`
   - `checks.realtime.status=healthy`
3. Validate live stream:
   - Connect to `/api/stream`, verify `connected.backend=redis`.
4. Validate replay:
   - Capture SSE `id`, reconnect with `Last-Event-ID`, confirm missed events replay.
5. Enable strict mode:
   - Set `REALTIME_ENFORCE_REDIS=true`.
6. Re-validate `/api/health` and `/api/stream`.

## Production Cutover Procedure

1. Roll out `REALTIME_BACKEND=redis` with strict mode disabled.
2. Confirm health/readiness in all instances via `/api/health`.
3. Confirm SSE connected events report `backend=redis`.
4. Confirm replay behavior using controlled reconnect tests.
5. Enable `REALTIME_ENFORCE_REDIS=true`.
6. Monitor:
   - `/api/health` realtime status
   - SSE connection success rate
   - action publish latency/error logs

## Rollback Procedure

1. Set `REALTIME_ENFORCE_REDIS=false`.
2. Set `REALTIME_BACKEND=memory`.
3. Redeploy.
4. Verify `/api/health` returns realtime `status=healthy` with `selected_backend=memory`.
5. Verify `/api/stream` resumes normal operation.

## Success Criteria

- Health endpoint shows realtime healthy after cutover.
- SSE live updates continue across reconnects.
- Replay on `Last-Event-ID` works within configured window.
- Rollback path is documented and executable via env flags only.
