---
source-of-truth: true
owner: Realtime/Infra Lead
last-verified: 2026-02-13
doc-type: rfc
---

# WS3 Milestone 1: SSE Broker and Channel Strategy

- Related plan: `docs/rfcs/platform-convergence.md`
- Workstream: WS3 Realtime Reliability
- Milestone target: February 20, 2026
- Status: Approved design baseline

## Current State

- Realtime events are published via in-memory EventEmitter in `app/lib/events.js`.
- SSE clients subscribe through `app/api/stream/route.js`.
- Limitation: events are instance-local and do not fan out across multi-instance deployments.

## Decision

Use Redis-backed pub/sub plus short-window stream replay for SSE delivery.

## Channel Strategy

- Pub/Sub channel: `dashclaw:org:{orgId}:events`
- Replay stream key: `dashclaw:org:{orgId}:stream`
- Optional global ops channel: `dashclaw:ops:events`

## Event Envelope

```json
{
  "id": "evt_01J...",
  "org_id": "org_...",
  "event": "action.updated",
  "timestamp": "2026-02-13T18:00:00.000Z",
  "version": "v1",
  "payload": {}
}
```

Required fields:

- `id`: globally unique event id used for idempotency and replay.
- `org_id`: tenant routing key.
- `event`: event type (`action.created`, `action.updated`, `signal.detected`, etc.).
- `timestamp`: server timestamp (ISO8601 UTC).
- `version`: envelope contract version.
- `payload`: event body.

## Replay Window

- Persist each event to Redis stream with bounded retention.
- Initial retention target: 10 minutes.
- SSE route supports `Last-Event-ID`:
  - If present, route replays missed events for the org from stream.
  - Then route transitions to live pub/sub.

## Runtime Controls

- `REALTIME_BACKEND=memory|redis` (default `memory` until cutover).
- `REDIS_URL=<connection-string>` required when backend is `redis`.
- `REALTIME_REPLAY_WINDOW_SECONDS=600` (default 10 minutes).

## Migration Plan

1. Add broker abstraction layer with `publish` and `subscribe` methods.
2. Keep current in-memory implementation as fallback.
3. Add Redis broker implementation behind feature flag.
4. Update SSE route to:
   - replay by `Last-Event-ID`
   - attach live subscription
5. Roll out by environment with rollback to `memory` backend switch.

## Rollback Plan

- Flip `REALTIME_BACKEND` from `redis` to `memory`.
- Keep producer event publishing API unchanged to avoid route changes during rollback.

## Acceptance For This Milestone

- Broker architecture and channel names defined.
- Event envelope contract defined.
- Replay strategy defined.
- Runtime flags and rollback strategy defined.
