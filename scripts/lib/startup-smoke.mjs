export function formatSetupStatusSummary(body = {}, status = null) {
  const http = status == null ? '' : `http=${status} `;
  const configured = body?.configured === true ? 'configured' : 'not_configured';
  const reason = body?.reason ? ` reason=${body.reason}` : '';
  const message = body?.message ? ` message="${body.message}"` : '';
  return `${http}${configured}${reason}${message}`.trim();
}

export async function waitForConfiguredSetup({
  url,
  fetchImpl = fetch,
  sleepImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  timeoutMs = 45000,
  intervalMs = 1000,
  shouldAbort = null,
} = {}) {
  const startedAt = Date.now();
  let lastSummary = 'no response received';

  while (Date.now() - startedAt < timeoutMs) {
    if (shouldAbort?.()) {
      throw new Error(`startup smoke aborted before setup configured: ${lastSummary}`);
    }

    try {
      const response = await fetchImpl(url);
      let body = {};
      try {
        body = await response.json();
      } catch {
        body = {};
      }

      lastSummary = formatSetupStatusSummary(body, response.status);
      if (response.status === 200 && body?.configured === true) {
        return body;
      }
    } catch (error) {
      lastSummary = `request_failed ${error.message}`;
    }

    await sleepImpl(intervalMs);
  }

  throw new Error(`startup smoke timed out waiting for configured setup status from ${url}; last=${lastSummary}`);
}

export function sendTerminationSignal({
  child,
  signal,
  isDetached = false,
  platform = process.platform,
  killImpl = process.kill,
} = {}) {
  if (!child) return;

  if (platform !== 'win32' && isDetached && Number.isInteger(child.pid)) {
    killImpl(-child.pid, signal);
    return;
  }

  child.kill(signal);
}

export async function shutdownChildProcess({
  child,
  hasExited = () => false,
  exitPromise = Promise.resolve(),
  sleepImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  graceMs = 5000,
  isDetached = false,
  platform = process.platform,
  killImpl = process.kill,
} = {}) {
  if (!child || hasExited()) return;

  sendTerminationSignal({ child, signal: 'SIGTERM', isDetached, platform, killImpl });

  if (graceMs <= 0) {
    if (!hasExited()) {
      sendTerminationSignal({ child, signal: 'SIGKILL', isDetached, platform, killImpl });
    }
    return;
  }

  const deadline = Date.now() + graceMs;
  while (!hasExited() && Date.now() < deadline) {
    await Promise.race([exitPromise, sleepImpl(50)]);
  }

  if (!hasExited()) {
    sendTerminationSignal({ child, signal: 'SIGKILL', isDetached, platform, killImpl });
  }
}
