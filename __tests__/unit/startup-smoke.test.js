import { describe, expect, it, vi } from 'vitest';
import { formatSetupStatusSummary, shutdownChildProcess, waitForConfiguredSetup } from '../../scripts/lib/startup-smoke.mjs';

describe('startup smoke runner', () => {
  it('returns immediately when setup status is configured', async () => {
    const fetchImpl = vi.fn(async () => ({
      status: 200,
      async json() {
        return { configured: true, message: 'Dashboard is configured' };
      },
    }));

    const result = await waitForConfiguredSetup({
      url: 'http://127.0.0.1:3000/api/setup/status',
      fetchImpl,
      sleepImpl: async () => {},
      timeoutMs: 100,
      intervalMs: 1,
    });

    expect(result.configured).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries until setup status becomes configured', async () => {
    const responses = [
      { status: 200, body: { configured: false, reason: 'no_tables', message: 'Missing 2 core table(s). Run migrations.' } },
      { status: 200, body: { configured: false, reason: 'no_tables', message: 'Missing 1 core table(s). Run migrations.' } },
      { status: 200, body: { configured: true, message: 'Dashboard is configured' } },
    ];

    const fetchImpl = vi.fn(async () => {
      const next = responses.shift();
      return {
        status: next.status,
        async json() {
          return next.body;
        },
      };
    });

    const result = await waitForConfiguredSetup({
      url: 'http://127.0.0.1:3000/api/setup/status',
      fetchImpl,
      sleepImpl: async () => {},
      timeoutMs: 100,
      intervalMs: 1,
    });

    expect(result.configured).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('throws with the last seen status when setup never becomes configured', async () => {
    const fetchImpl = vi.fn(async () => ({
      status: 200,
      async json() {
        return { configured: false, reason: 'no_tables', message: 'Missing 6 core table(s). Run migrations.' };
      },
    }));

    await expect(waitForConfiguredSetup({
      url: 'http://127.0.0.1:3000/api/setup/status',
      fetchImpl,
      sleepImpl: async () => {},
      timeoutMs: 10,
      intervalMs: 1,
    })).rejects.toThrow(/no_tables/i);
  });

  it('formats setup status summaries for logs', () => {
    expect(formatSetupStatusSummary({ configured: true, message: 'Dashboard is configured' }, 200)).toContain('configured');
    expect(formatSetupStatusSummary({ configured: false, reason: 'connection_error' }, 500)).toContain('connection_error');
  });

  it('waits for child shutdown after SIGTERM', async () => {
    const child = { kill: vi.fn() };
    let exited = false;
    let resolveExit;
    const exitPromise = new Promise((resolve) => {
      resolveExit = () => {
        exited = true;
        resolve();
      };
    });

    await shutdownChildProcess({
      child,
      hasExited: () => exited,
      exitPromise,
      sleepImpl: async () => {
        resolveExit();
      },
      graceMs: 10,
    });

    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(child.kill).toHaveBeenCalledTimes(1);
  });

  it('forces SIGKILL when the child ignores SIGTERM', async () => {
    const child = { kill: vi.fn() };

    await shutdownChildProcess({
      child,
      hasExited: () => false,
      exitPromise: new Promise(() => {}),
      sleepImpl: async () => {},
      graceMs: 0,
    });

    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(child.kill).toHaveBeenCalledWith('SIGKILL');
  });
});
