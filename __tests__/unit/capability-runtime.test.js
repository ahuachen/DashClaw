import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/repositories/capabilities.repository.js', () => ({
  getCapability: vi.fn(),
}));

vi.mock('@/lib/repositories/settings.repository.js', () => ({
  getSettings: vi.fn(),
}));

vi.mock('@/lib/capability-invoke.js', () => ({
  resolveAuth: vi.fn(),
  invokeCapability: vi.fn(),
}));

vi.mock('@/lib/mapping.js', () => ({
  resolveEndpointUrl: vi.fn(),
}));

import {
  prepareCapabilityInvocation,
  executeCapabilityInvocation,
} from '@/lib/capability-runtime.js';
import { getCapability } from '@/lib/repositories/capabilities.repository.js';
import { getSettings } from '@/lib/repositories/settings.repository.js';
import { resolveAuth, invokeCapability } from '@/lib/capability-invoke.js';
import { resolveEndpointUrl } from '@/lib/mapping.js';

describe('prepareCapabilityInvocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads capability and resolves auth and endpoint from org settings', async () => {
    getCapability.mockResolvedValue({
      capability_id: 'cap_1',
      source_type: 'http_api',
      invocation_schema: {
        endpoint: { setting: 'API_BASE' },
        method: 'POST',
        auth: { type: 'bearer', token_setting: 'API_TOKEN' },
        request_mapping: { query: '$.query' },
        response_mapping: { answer: '$.answer' },
        timeout_ms: 1234,
      },
    });
    getSettings.mockResolvedValue([
      { key: 'API_BASE', value: 'https://api.example.com/search' },
      { key: 'API_TOKEN', value: 'secret' },
    ]);
    resolveAuth.mockReturnValue({ Authorization: 'Bearer secret' });
    resolveEndpointUrl.mockReturnValue('https://api.example.com/search');

    const prepared = await prepareCapabilityInvocation({}, 'org_1', 'cap_1');

    expect(resolveAuth).toHaveBeenCalledWith(
      { type: 'bearer', token_setting: 'API_TOKEN' },
      { API_BASE: 'https://api.example.com/search', API_TOKEN: 'secret' },
    );
    expect(resolveEndpointUrl).toHaveBeenCalledWith(
      { setting: 'API_BASE' },
      { API_BASE: 'https://api.example.com/search', API_TOKEN: 'secret' },
    );
    expect(prepared).toEqual({
      capability: expect.objectContaining({ capability_id: 'cap_1' }),
      schema: expect.objectContaining({ method: 'POST', timeout_ms: 1234 }),
      authHeaders: { Authorization: 'Bearer secret' },
      endpoint: 'https://api.example.com/search',
    });
  });

  it('throws when capability is missing', async () => {
    getCapability.mockResolvedValue(null);

    await expect(prepareCapabilityInvocation({}, 'org_1', 'cap_missing')).rejects.toThrow(
      'Capability not found: cap_missing',
    );
  });

  it('throws when capability is not http_api', async () => {
    getCapability.mockResolvedValue({
      capability_id: 'cap_1',
      source_type: 'webhook',
    });

    await expect(prepareCapabilityInvocation({}, 'org_1', 'cap_1')).rejects.toThrow(
      'Capability cap_1 is not an http_api type',
    );
  });
});

describe('executeCapabilityInvocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invokes the resolved capability contract', async () => {
    invokeCapability.mockResolvedValue({
      success: true,
      data: { answer: 'ok' },
      elapsed_ms: 45,
    });

    const result = await executeCapabilityInvocation({
      endpoint: 'https://api.example.com/search',
      authHeaders: { Authorization: 'Bearer secret' },
      schema: {
        method: 'POST',
        request_mapping: { query: '$.query' },
        response_mapping: { answer: '$.answer' },
        timeout_ms: 2500,
      },
      body: { query: 'test' },
    });

    expect(invokeCapability).toHaveBeenCalledWith({
      endpoint: 'https://api.example.com/search',
      method: 'POST',
      authHeaders: { Authorization: 'Bearer secret' },
      body: { query: 'test' },
      requestMapping: { query: '$.query' },
      responseMapping: { answer: '$.answer' },
      timeoutMs: 2500,
    });
    expect(result).toEqual({
      success: true,
      data: { answer: 'ok' },
      elapsed_ms: 45,
    });
  });
});
