import { describe, expect, it } from 'vitest';

import {
  compileCapabilityPayload,
  deriveCapabilityMode,
  deriveGeneratedInputFields,
  isRunnableHttpCapability,
} from '@/capabilities/lib/capabilityFormModel.js';

describe('capabilityFormModel', () => {
  it('compiles registry-only capability payloads without invocation schema', () => {
    const payload = compileCapabilityPayload({
      mode: 'registry_only',
      metadata: {
        name: 'Slack Notify',
        description: 'Registry entry for Slack notifications',
        category: 'messaging',
        source_type: 'internal_sdk',
        auth_type: 'none',
        risk_level: 'medium',
        requires_approval: true,
        tags: ['slack', 'notify'],
        docs_url: 'https://docs.example.com/slack',
        health_status: 'unknown',
      },
    });

    expect(payload).toEqual({
      name: 'Slack Notify',
      description: 'Registry entry for Slack notifications',
      category: 'messaging',
      source_type: 'internal_sdk',
      auth_type: 'none',
      risk_level: 'medium',
      requires_approval: true,
      tags: ['slack', 'notify'],
      docs_url: 'https://docs.example.com/slack',
      health_status: 'unknown',
    });
    expect(payload).not.toHaveProperty('invocation_schema');
  });

  it('compiles runnable HTTP capability payloads into invocation schema', () => {
    const payload = compileCapabilityPayload({
      mode: 'runnable_http',
      metadata: {
        name: 'Slack Message Sender',
        description: 'Send a Slack message by HTTP',
        category: 'messaging',
        auth_type: 'bearer',
        risk_level: 'medium',
        requires_approval: false,
        tags: ['slack', 'message'],
        docs_url: '',
        health_status: 'unknown',
      },
      runtime: {
        endpoint: 'https://slack.example.com/api/messages',
        method: 'POST',
        timeout_ms: 15000,
        auth: {
          type: 'bearer',
          token_setting: 'SLACK_BOT_TOKEN',
        },
        inputFields: [
          { key: 'channel', label: 'Channel', type: 'string', required: true, helpText: 'Slack channel ID' },
          { key: 'text', label: 'Message text', type: 'string', required: true, helpText: 'Message body' },
          { key: 'urgent', label: 'Urgent', type: 'boolean', required: false, helpText: '' },
        ],
      },
    });

    expect(payload).toMatchObject({
      name: 'Slack Message Sender',
      source_type: 'http_api',
      auth_type: 'bearer',
      risk_level: 'medium',
      requires_approval: false,
      tags: ['slack', 'message'],
      invocation_schema: {
        endpoint: 'https://slack.example.com/api/messages',
        method: 'POST',
        timeout_ms: 15000,
        auth: {
          type: 'bearer',
          token_setting: 'SLACK_BOT_TOKEN',
        },
        input_schema: {
          type: 'object',
          required: ['channel', 'text'],
          properties: {
            channel: { type: 'string' },
            text: { type: 'string' },
            urgent: { type: 'boolean' },
          },
        },
      },
    });
  });

  it('derives generated test fields from stored input schema', () => {
    const fields = deriveGeneratedInputFields({
      source_type: 'http_api',
      invocation_schema: {
        input_schema: {
          type: 'object',
          required: ['channel'],
          properties: {
            channel: { type: 'string', title: 'Slack channel', description: 'Channel ID' },
            text: { type: 'string', description: 'Message body' },
            urgent: { type: 'boolean' },
          },
        },
      },
    });

    expect(fields).toEqual([
      {
        key: 'channel',
        label: 'Slack channel',
        type: 'string',
        required: true,
        helpText: 'Channel ID',
      },
      {
        key: 'text',
        label: 'text',
        type: 'string',
        required: false,
        helpText: 'Message body',
      },
      {
        key: 'urgent',
        label: 'urgent',
        type: 'boolean',
        required: false,
        helpText: '',
      },
    ]);
  });

  it('compiles retry_policy into invocation_schema when max_retries > 0', () => {
    const payload = compileCapabilityPayload({
      mode: 'runnable_http',
      metadata: { name: 'Test', risk_level: 'low' },
      runtime: {
        endpoint: 'https://api.example.com/test',
        method: 'POST',
        timeout_ms: 5000,
        auth: { type: 'none' },
        inputFields: [],
        retry_policy: {
          max_retries: 3,
          backoff: 'exponential',
          base_delay_ms: 1000,
          max_delay_ms: 15000,
        },
      },
    });

    expect(payload.invocation_schema.retry_policy).toEqual({
      max_retries: 3,
      backoff: 'exponential',
      base_delay_ms: 1000,
      max_delay_ms: 15000,
    });
  });

  it('omits retry_policy when max_retries is 0', () => {
    const payload = compileCapabilityPayload({
      mode: 'runnable_http',
      metadata: { name: 'Test', risk_level: 'low' },
      runtime: {
        endpoint: 'https://api.example.com/test',
        method: 'POST',
        timeout_ms: 5000,
        auth: { type: 'none' },
        inputFields: [],
        retry_policy: { max_retries: 0, backoff: 'none' },
      },
    });

    expect(payload.invocation_schema).not.toHaveProperty('retry_policy');
  });

  it('omits retry_policy when retry_policy is absent from runtime', () => {
    const payload = compileCapabilityPayload({
      mode: 'runnable_http',
      metadata: { name: 'Test', risk_level: 'low' },
      runtime: {
        endpoint: 'https://api.example.com/test',
        method: 'POST',
        timeout_ms: 5000,
        auth: { type: 'none' },
        inputFields: [],
      },
    });

    expect(payload.invocation_schema).not.toHaveProperty('retry_policy');
  });

  it('compiles circuit_breaker into invocation_schema when enabled', () => {
    const payload = compileCapabilityPayload({
      mode: 'runnable_http',
      metadata: { name: 'Test', risk_level: 'low' },
      runtime: {
        endpoint: 'https://api.example.com/test',
        method: 'POST',
        timeout_ms: 5000,
        auth: { type: 'none' },
        inputFields: [],
        circuit_breaker: {
          enabled: true,
          consecutive_failures: 10,
        },
      },
    });

    expect(payload.invocation_schema.circuit_breaker).toEqual({
      enabled: true,
      consecutive_failures: 10,
    });
  });

  it('omits circuit_breaker when not enabled', () => {
    const payload = compileCapabilityPayload({
      mode: 'runnable_http',
      metadata: { name: 'Test', risk_level: 'low' },
      runtime: {
        endpoint: 'https://api.example.com/test',
        method: 'POST',
        timeout_ms: 5000,
        auth: { type: 'none' },
        inputFields: [],
        circuit_breaker: { enabled: false, consecutive_failures: 5 },
      },
    });

    expect(payload.invocation_schema).not.toHaveProperty('circuit_breaker');
  });

  it('classifies runnable HTTP capabilities separately from registry-only entries', () => {
    const runnable = {
      source_type: 'http_api',
      invocation_schema: {
        endpoint: 'https://api.example.com/send',
        input_schema: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
      },
    };

    const registryOnly = {
      source_type: 'internal_sdk',
      invocation_schema: {},
    };

    expect(isRunnableHttpCapability(runnable)).toBe(true);
    expect(isRunnableHttpCapability(registryOnly)).toBe(false);
    expect(deriveCapabilityMode(runnable)).toBe('runnable_http');
    expect(deriveCapabilityMode(registryOnly)).toBe('registry_only');
  });
});
