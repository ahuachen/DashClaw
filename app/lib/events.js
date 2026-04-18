import { EventEmitter } from 'events';
import crypto from 'crypto';

export const EVENTS = {
  ACTION_CREATED: 'action.created',
  ACTION_UPDATED: 'action.updated',
  ACTION_COST_EXCEEDED: 'action.cost_exceeded',
  SIGNAL_DETECTED: 'signal.detected',
  TOKEN_USAGE: 'token.usage',
  MESSAGE_CREATED: 'message.created',
  POLICY_UPDATED: 'policy.updated',
  TASK_ASSIGNED: 'task.assigned',
  TASK_COMPLETED: 'task.completed',
  DECISION_CREATED: 'decision.created',
  GUARD_DECISION_CREATED: 'guard.decision.created',
  LOOP_CREATED: 'loop.created',
  LOOP_UPDATED: 'loop.updated',
  GOAL_CREATED: 'goal.created',
  GOAL_UPDATED: 'goal.updated',
};

const EVENT_VERSION = 'v1';
const ORG_CHANNEL_PREFIX = 'dashclaw:org';
const requestedBackend = (process.env.REALTIME_BACKEND || 'memory').toLowerCase();
const redisUrl = process.env.REDIS_URL || process.env.REALTIME_REDIS_URL || '';
const enforceRedisCutover = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.REALTIME_ENFORCE_REDIS || '').toLowerCase()
);
const replayWindowSeconds = Math.max(60, parseInt(process.env.REALTIME_REPLAY_WINDOW_SECONDS || '600', 10) || 600);
const replayWindowMs = replayWindowSeconds * 1000;
const replayBufferMax = Math.max(200, parseInt(process.env.REALTIME_REPLAY_MAX_EVENTS || '1000', 10) || 1000);
const memoryMaxListeners = (() => {
  const raw = process.env.REALTIME_MEMORY_MAX_LISTENERS || process.env.REALTIME_MAX_LISTENERS || '1000';
  const n = parseInt(raw, 10);
  // 0 means unlimited in Node's EventEmitter.
  if (Number.isFinite(n) && n >= 0) return n;
  return 1000;
})();

class MemoryRealtimeBackend {
  constructor() {
    this.emitter = new EventEmitter();
    // Many concurrent SSE connections are normal. Raise the default limit to avoid false-positive warnings.
    this.emitter.setMaxListeners(memoryMaxListeners);
    this.replayByOrg = new Map();
    this.cursorByOrg = new Map();
  }

  channelForOrg(orgId) {
    return `${ORG_CHANNEL_PREFIX}:${orgId}:events`;
  }

  nextCursor(orgId) {
    const next = (this.cursorByOrg.get(orgId) || 0) + 1;
    this.cursorByOrg.set(orgId, next);
    return `mem-${next}`;
  }

  parseCursor(cursor) {
    if (!cursor || typeof cursor !== 'string' || !cursor.startsWith('mem-')) return null;
    const value = parseInt(cursor.slice(4), 10);
    return Number.isNaN(value) ? null : value;
  }

  prune(orgId) {
    const now = Date.now();
    const cutoff = now - replayWindowMs;
    const existing = this.replayByOrg.get(orgId) || [];
    const byTime = existing.filter((evt) => {
      const ts = Date.parse(evt.timestamp || '');
      return Number.isNaN(ts) || ts >= cutoff;
    });
    const trimmed = byTime.slice(-replayBufferMax);
    this.replayByOrg.set(orgId, trimmed);
    return trimmed;
  }

  async publish(envelope) {
    const withCursor = {
      ...envelope,
      cursor: envelope.cursor || this.nextCursor(envelope.org_id),
    };
    const current = this.replayByOrg.get(envelope.org_id) || [];
    current.push(withCursor);
    this.replayByOrg.set(envelope.org_id, current);
    this.prune(envelope.org_id);
    this.emitter.emit(this.channelForOrg(withCursor.org_id), withCursor);
    return withCursor;
  }

  async subscribe(orgId, handler) {
    const channel = this.channelForOrg(orgId);
    const listener = (envelope) => handler(envelope);
    this.emitter.on(channel, listener);
    return async () => {
      this.emitter.off(channel, listener);
    };
  }

  async replay(orgId, { afterCursor, limit = 200 } = {}) {
    const safeLimit = Math.min(Math.max(limit, 1), replayBufferMax);
    const events = this.prune(orgId);
    if (!afterCursor) {
      return events.slice(-safeLimit);
    }

    const numericAfter = this.parseCursor(afterCursor);
    if (numericAfter != null) {
      const replay = events.filter((evt) => {
        const cur = this.parseCursor(evt.cursor);
        return cur != null && cur > numericAfter;
      });
      return replay.slice(0, safeLimit);
    }

    const index = events.findIndex((evt) => evt.cursor === afterCursor);
    if (index === -1) {
      return [];
    }
    return events.slice(index + 1, index + 1 + safeLimit);
  }
}

class RedisRealtimeBackend {
  constructor(url) {
    this.url = url;
    this.publisher = null;
    this.createClient = null;
  }

  channelForOrg(orgId) {
    return `${ORG_CHANNEL_PREFIX}:${orgId}:events`;
  }

  streamKeyForOrg(orgId) {
    return `${ORG_CHANNEL_PREFIX}:${orgId}:stream`;
  }

  async loadRedisClientFactory() {
    if (this.createClient) return this.createClient;
    const mod = await import('redis');
    this.createClient = mod.createClient;
    return this.createClient;
  }

  async getPublisher() {
    if (this.publisher) return this.publisher;
    const createClient = await this.loadRedisClientFactory();
    this.publisher = createClient({ url: this.url });
    this.publisher.on('error', (err) => {
      console.error('[REALTIME] Redis publisher error:', err?.message || err);
    });
    await this.publisher.connect();
    return this.publisher;
  }

  async publish(envelope) {
    const publisher = await this.getPublisher();
    let withCursor = envelope;

    try {
      const streamId = await publisher.sendCommand([
        'XADD',
        this.streamKeyForOrg(envelope.org_id),
        'MAXLEN',
        '~',
        String(replayBufferMax),
        '*',
        'data',
        JSON.stringify(envelope),
      ]);
      withCursor = { ...envelope, cursor: streamId };
    } catch (err) {
      console.error('[REALTIME] Redis XADD failed:', err?.message || err);
    }

    await publisher.publish(this.channelForOrg(withCursor.org_id), JSON.stringify(withCursor));
    return withCursor;
  }

  async ping() {
    const publisher = await this.getPublisher();
    const pong = await publisher.ping();
    return String(pong || '').toUpperCase() === 'PONG';
  }

  async subscribe(orgId, handler) {
    const createClient = await this.loadRedisClientFactory();
    const subscriber = createClient({ url: this.url });
    subscriber.on('error', (err) => {
      console.error('[REALTIME] Redis subscriber error:', err?.message || err);
    });
    await subscriber.connect();

    const channel = this.channelForOrg(orgId);
    await subscriber.subscribe(channel, (message) => {
      try {
        const parsed = JSON.parse(message);
        handler(parsed);
      } catch (err) {
        console.error('[REALTIME] Failed to parse Redis event message:', err?.message || err);
      }
    });

    return async () => {
      try {
        await subscriber.unsubscribe(channel);
      } catch {}
      try {
        await subscriber.quit();
      } catch {}
    };
  }

  parseStreamData(fields) {
    if (Array.isArray(fields)) {
      for (let i = 0; i < fields.length - 1; i += 2) {
        if (fields[i] === 'data') return fields[i + 1];
      }
      return null;
    }

    if (fields && typeof fields === 'object') {
      return fields.data || null;
    }

    return null;
  }

  async replay(orgId, { afterCursor, limit = 200 } = {}) {
    const publisher = await this.getPublisher();
    const safeLimit = Math.min(Math.max(limit, 1), replayBufferMax);
    const start = afterCursor ? `(${afterCursor}` : '-';
    const streamKey = this.streamKeyForOrg(orgId);
    const now = Date.now();
    const cutoff = now - replayWindowMs;

    let raw;
    try {
      raw = await publisher.sendCommand([
        'XRANGE',
        streamKey,
        start,
        '+',
        'COUNT',
        String(safeLimit),
      ]);
    } catch (err) {
      // If cursor is invalid for redis stream, treat as no replay available.
      if (afterCursor) return [];
      throw err;
    }

    if (!Array.isArray(raw)) return [];

    const out = [];
    for (const entry of raw) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      const streamId = entry[0];
      const dataRaw = this.parseStreamData(entry[1]);
      if (!dataRaw) continue;
      try {
        const parsed = JSON.parse(dataRaw);
        const ts = Date.parse(parsed.timestamp || '');
        if (!Number.isNaN(ts) && ts < cutoff) continue;
        out.push({
          ...parsed,
          cursor: parsed.cursor || streamId,
        });
      } catch {
        // Ignore malformed replay records
      }
    }
    return out;
  }
}

const memoryBackend = new MemoryRealtimeBackend();
let selectedBackendName = 'memory';
let selectedBackend = memoryBackend;

if (requestedBackend === 'redis') {
  if (redisUrl) {
    selectedBackendName = 'redis';
    selectedBackend = new RedisRealtimeBackend(redisUrl);
  } else {
    console.warn('[REALTIME] REALTIME_BACKEND=redis but REDIS_URL is missing. Falling back to memory backend.');
  }
} else if (process.env.NODE_ENV === 'production') {
  console.warn('[realtime] WARNING: Using in-memory event backend in production. SSE events will be lost between serverless invocations. Set REDIS_URL (Upstash free tier works) for persistent realtime events.');
}

function createEventEnvelope(event, orgId, payload) {
  return {
    id: `evt_${crypto.randomUUID()}`,
    org_id: orgId,
    event,
    timestamp: new Date().toISOString(),
    version: EVENT_VERSION,
    payload,
  };
}

export function getRealtimeBackendName() {
  return selectedBackendName;
}

export function getRealtimeConfig() {
  return {
    requested_backend: requestedBackend,
    selected_backend: selectedBackendName,
    redis_configured: Boolean(redisUrl),
    enforce_redis_cutover: enforceRedisCutover,
    replay_window_seconds: replayWindowSeconds,
    replay_max_events: replayBufferMax,
  };
}

export async function getRealtimeHealth() {
  const config = getRealtimeConfig();

  if (config.enforce_redis_cutover && config.selected_backend !== 'redis') {
    return {
      status: 'unhealthy',
      reason: 'REALTIME_ENFORCE_REDIS is enabled but redis backend is not active',
      ...config,
    };
  }

  if (config.selected_backend !== 'redis') {
    return {
      status: 'healthy',
      reason: 'memory backend active',
      ...config,
    };
  }

  try {
    const redisOk = await selectedBackend.ping();
    if (!redisOk) {
      return {
        status: config.enforce_redis_cutover ? 'unhealthy' : 'degraded',
        reason: 'redis ping failed',
        ...config,
      };
    }

    return {
      status: 'healthy',
      reason: 'redis backend active and reachable',
      ...config,
    };
  } catch (err) {
    return {
      status: config.enforce_redis_cutover ? 'unhealthy' : 'degraded',
      reason: `redis health check failed: ${err?.message || err}`,
      ...config,
    };
  }
}

export async function publishOrgEvent(event, { orgId, ...payload } = {}) {
  if (!orgId) return;
  const envelope = createEventEnvelope(event, orgId, payload);

  // Always publish to memory backend to keep local fallback path alive.
  await memoryBackend.publish(envelope);

  if (selectedBackendName === 'memory') return;

  try {
    await selectedBackend.publish(envelope);
  } catch (err) {
    console.error('[REALTIME] Redis publish failed; event delivered only locally:', err?.message || err);
  }
}

export async function subscribeOrgEvents(orgId, handler) {
  if (!orgId) {
    return async () => {};
  }

  if (selectedBackendName === 'memory') {
    return memoryBackend.subscribe(orgId, handler);
  }

  try {
    return await selectedBackend.subscribe(orgId, handler);
  } catch (err) {
    if (enforceRedisCutover) {
      throw err;
    }
    console.error('[REALTIME] Redis subscribe failed; falling back to memory backend:', err?.message || err);
    return memoryBackend.subscribe(orgId, handler);
  }
}

export async function replayOrgEvents(orgId, { afterCursor, limit = 200 } = {}) {
  if (!orgId) return [];

  if (selectedBackendName === 'memory') {
    return memoryBackend.replay(orgId, { afterCursor, limit });
  }

  try {
    return await selectedBackend.replay(orgId, { afterCursor, limit });
  } catch (err) {
    if (enforceRedisCutover) {
      throw err;
    }
    console.error('[REALTIME] Redis replay failed; falling back to memory replay:', err?.message || err);
    return memoryBackend.replay(orgId, { afterCursor, limit });
  }
}
