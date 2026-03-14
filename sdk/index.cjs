/**
 * DashClaw SDK v2 (Stable Runtime API)
 * CommonJS compatibility bridge.
 * 
 * ESM: import { DashClaw } from 'dashclaw'
 * CJS: const { DashClaw } = require('dashclaw')
 */

const fs = require('fs');
const path = require('path');

// Minimal CommonJS shim for the v2 SDK
// We use a simplified bridge that forwards calls to the async ESM import
let _module;

async function loadModule() {
  if (!_module) {
    _module = await import('./dashclaw.js');
  }
  return _module;
}

module.exports = {
  // Sync wrapper that returns a proxy for the DashClaw class
  DashClaw: class DashClawProxy {
    constructor(opts) {
      this._opts = opts;
      this._ready = loadModule().then(m => {
        this._instance = new m.DashClaw(opts);
      });

      return new Proxy(this, {
        get(target, prop) {
          if (prop in target) return target[prop];
          if (prop === 'then') return undefined;

          return async (...args) => {
            await target._ready;
            if (!target._instance[prop]) {
              throw new Error(`Method ${String(prop)} does not exist on DashClaw v2`);
            }
            return target._instance[prop](...args);
          };
        }
      });
    }

    static async create(opts) {
      const mod = await loadModule();
      return new mod.DashClaw(opts);
    }
  },

  // Errors from v2
  ApprovalDeniedError: class ApprovalDeniedError extends Error {
    constructor(message, decision) {
      super(message);
      this.name = 'ApprovalDeniedError';
      this.decision = decision;
    }
  },

  GuardBlockedError: class GuardBlockedError extends Error {
    constructor(decision) {
      super(decision.reason || 'Action blocked by policy');
      this.name = 'GuardBlockedError';
      this.decision = decision;
    }
  }
};
