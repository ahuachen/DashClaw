/**
 * Capability invocation engine.
 * Handles auth resolution, HTTP calls with timeout, and request/response mapping.
 */

import { mapRequest, mapResponse } from './mapping.js';

export const RISK_SCORE_MAP = {
  low: 20,
  medium: 50,
  high: 75,
  critical: 95,
};

export function resolveAuth(auth, settings) {
  if (!auth || auth.type === 'none') return {};

  const tokenKey = auth.token_setting;
  if (!tokenKey) return {};

  const token = settings[tokenKey];
  if (!token) {
    const err = new Error(`auth_not_configured: setting '${tokenKey}' not configured for this capability`);
    err.code = 'auth_not_configured';
    throw err;
  }

  if (auth.type === 'bearer') {
    return { Authorization: `Bearer ${token}` };
  }
  if (auth.type === 'api_key') {
    return { 'x-api-key': token };
  }
  return {};
}

export async function invokeCapability({
  endpoint,
  method,
  authHeaders,
  body,
  requestMapping,
  responseMapping,
  timeoutMs,
}) {
  const mappedBody = mapRequest(body, requestMapping);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 60000);
  const start = Date.now();

  try {
    const response = await fetch(endpoint, {
      method: method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(mappedBody),
      signal: controller.signal,
    });

    clearTimeout(timer);
    const elapsedMs = Date.now() - start;

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return {
        success: false,
        error: 'capability_error',
        status: response.status,
        message: errorText.slice(0, 500),
        elapsed_ms: elapsedMs,
      };
    }

    const rawData = await response.json();
    const data = mapResponse(rawData, responseMapping);

    return {
      success: true,
      data,
      raw: rawData,
      elapsed_ms: elapsedMs,
    };
  } catch (err) {
    clearTimeout(timer);
    const elapsedMs = Date.now() - start;

    if (err.name === 'AbortError') {
      return {
        success: false,
        error: 'capability_timeout',
        message: `Capability timed out after ${timeoutMs || 60000}ms`,
        elapsed_ms: elapsedMs,
      };
    }

    return {
      success: false,
      error: 'capability_network_error',
      message: err.message,
      elapsed_ms: elapsedMs,
    };
  }
}
