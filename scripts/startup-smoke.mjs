#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { shutdownChildProcess, waitForConfiguredSetup } from './lib/startup-smoke.mjs';

function parseArgs(argv) {
  const options = {
    baseUrl: process.env.STARTUP_SMOKE_BASE_URL || 'http://127.0.0.1:3000',
    timeoutMs: Number(process.env.STARTUP_SMOKE_TIMEOUT_MS || 45000),
    intervalMs: Number(process.env.STARTUP_SMOKE_INTERVAL_MS || 1000),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--base-url') options.baseUrl = argv[i + 1];
    if (arg === '--timeout-ms') options.timeoutMs = Number(argv[i + 1]);
    if (arg === '--interval-ms') options.intervalMs = Number(argv[i + 1]);
  }

  return options;
}

function createLogBuffer(limit = 200) {
  const lines = [];
  return {
    push(chunk) {
      const text = String(chunk || '').trim();
      if (!text) return;
      for (const line of text.split(/\r?\n/)) {
        lines.push(line);
        if (lines.length > limit) lines.shift();
      }
    },
    toString() {
      return lines.join('\n');
    },
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const setupStatusUrl = `${options.baseUrl.replace(/\/$/, '')}/api/setup/status`;
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(command, ['run', 'start'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  });

  const stdoutBuffer = createLogBuffer();
  const stderrBuffer = createLogBuffer();
  let childExited = false;
  let exitCode = null;
  let resolveExit;
  const exitPromise = new Promise((resolve) => {
    resolveExit = resolve;
  });

  child.stdout?.on('data', (chunk) => {
    stdoutBuffer.push(chunk);
  });

  child.stderr?.on('data', (chunk) => {
    stderrBuffer.push(chunk);
  });

  child.on('close', (code) => {
    childExited = true;
    exitCode = code;
    resolveExit(code);
  });

  try {
    const result = await waitForConfiguredSetup({
      url: setupStatusUrl,
      timeoutMs: options.timeoutMs,
      intervalMs: options.intervalMs,
      shouldAbort: () => childExited,
    });

    console.log(`[startup-smoke] configured: ${result.message || 'setup status is ready'}`);
  } catch (error) {
    console.error(`[startup-smoke] ${error.message}`);
    if (stdoutBuffer.toString()) {
      console.error('[startup-smoke] server stdout:');
      console.error(stdoutBuffer.toString());
    }
    if (stderrBuffer.toString()) {
      console.error('[startup-smoke] server stderr:');
      console.error(stderrBuffer.toString());
    }
    if (childExited) {
      console.error(`[startup-smoke] server exited early with code ${exitCode}`);
    }
    process.exitCode = 1;
  } finally {
    await shutdownChildProcess({
      child,
      hasExited: () => childExited,
      exitPromise,
      isDetached: process.platform !== 'win32',
    });
  }
}

await main();
