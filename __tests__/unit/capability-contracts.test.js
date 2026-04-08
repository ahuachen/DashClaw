import { describe, expect, it } from 'vitest';
import { validateInvocationSchema } from '../../app/lib/capability-contracts.js';

function validSchema(overrides = {}) {
  return {
    endpoint: 'https://api.example.com/test',
    method: 'POST',
    timeout_ms: 30000,
    auth: { type: 'none' },
    ...overrides,
  };
}

describe('validateInvocationSchema', () => {
  it('passes with no retry_policy', () => {
    expect(() => validateInvocationSchema('http_api', validSchema())).not.toThrow();
  });

  it('passes with valid retry_policy', () => {
    const schema = validSchema({
      retry_policy: {
        max_retries: 3,
        backoff: 'exponential',
        base_delay_ms: 1000,
        max_delay_ms: 30000,
        retryable_status_codes: [429, 500, 502, 503, 504],
      },
    });
    expect(() => validateInvocationSchema('http_api', schema)).not.toThrow();
  });

  it('passes with retry_policy containing only max_retries: 0', () => {
    const schema = validSchema({ retry_policy: { max_retries: 0 } });
    expect(() => validateInvocationSchema('http_api', schema)).not.toThrow();
  });

  it('rejects retry_policy that is not an object', () => {
    const schema = validSchema({ retry_policy: 'aggressive' });
    expect(() => validateInvocationSchema('http_api', schema)).toThrow('retry_policy must be an object');
  });

  it('rejects max_retries > 5', () => {
    const schema = validSchema({ retry_policy: { max_retries: 10 } });
    expect(() => validateInvocationSchema('http_api', schema)).toThrow('max_retries must be an integer between 0 and 5');
  });

  it('rejects negative max_retries', () => {
    const schema = validSchema({ retry_policy: { max_retries: -1 } });
    expect(() => validateInvocationSchema('http_api', schema)).toThrow('max_retries must be an integer between 0 and 5');
  });

  it('rejects non-integer max_retries', () => {
    const schema = validSchema({ retry_policy: { max_retries: 2.5 } });
    expect(() => validateInvocationSchema('http_api', schema)).toThrow('max_retries must be an integer between 0 and 5');
  });

  it('rejects invalid backoff strategy', () => {
    const schema = validSchema({ retry_policy: { backoff: 'aggressive' } });
    expect(() => validateInvocationSchema('http_api', schema)).toThrow('backoff must be one of');
  });

  it('rejects base_delay_ms below 100', () => {
    const schema = validSchema({ retry_policy: { base_delay_ms: 50 } });
    expect(() => validateInvocationSchema('http_api', schema)).toThrow('base_delay_ms must be an integer between 100 and 30000');
  });

  it('rejects base_delay_ms above 30000', () => {
    const schema = validSchema({ retry_policy: { base_delay_ms: 50000 } });
    expect(() => validateInvocationSchema('http_api', schema)).toThrow('base_delay_ms must be an integer between 100 and 30000');
  });

  it('rejects max_delay_ms above 60000', () => {
    const schema = validSchema({ retry_policy: { max_delay_ms: 120000 } });
    expect(() => validateInvocationSchema('http_api', schema)).toThrow('max_delay_ms must be an integer between 100 and 60000');
  });

  it('rejects non-array retryable_status_codes', () => {
    const schema = validSchema({ retry_policy: { retryable_status_codes: 503 } });
    expect(() => validateInvocationSchema('http_api', schema)).toThrow('retryable_status_codes must be an array');
  });

  it('rejects retryable_status_codes with out-of-range values', () => {
    const schema = validSchema({ retry_policy: { retryable_status_codes: [200, 503] } });
    expect(() => validateInvocationSchema('http_api', schema)).toThrow('retryable_status_codes must be an array of HTTP status codes');
  });

  it('skips validation for non-http_api source types', () => {
    expect(() => validateInvocationSchema('internal_sdk', { retry_policy: 'bad' })).not.toThrow();
  });

  it('passes with valid circuit_breaker', () => {
    const schema = validSchema({ circuit_breaker: { enabled: true, consecutive_failures: 10 } });
    expect(() => validateInvocationSchema('http_api', schema)).not.toThrow();
  });

  it('passes with circuit_breaker.enabled = false', () => {
    const schema = validSchema({ circuit_breaker: { enabled: false } });
    expect(() => validateInvocationSchema('http_api', schema)).not.toThrow();
  });

  it('rejects circuit_breaker that is not an object', () => {
    const schema = validSchema({ circuit_breaker: true });
    expect(() => validateInvocationSchema('http_api', schema)).toThrow('circuit_breaker must be an object');
  });

  it('rejects non-boolean circuit_breaker.enabled', () => {
    const schema = validSchema({ circuit_breaker: { enabled: 'yes' } });
    expect(() => validateInvocationSchema('http_api', schema)).toThrow('circuit_breaker.enabled must be a boolean');
  });

  it('rejects consecutive_failures below 1', () => {
    const schema = validSchema({ circuit_breaker: { consecutive_failures: 0 } });
    expect(() => validateInvocationSchema('http_api', schema)).toThrow('consecutive_failures must be an integer between 1 and 50');
  });

  it('rejects consecutive_failures above 50', () => {
    const schema = validSchema({ circuit_breaker: { consecutive_failures: 100 } });
    expect(() => validateInvocationSchema('http_api', schema)).toThrow('consecutive_failures must be an integer between 1 and 50');
  });

  it('rejects non-integer consecutive_failures', () => {
    const schema = validSchema({ circuit_breaker: { consecutive_failures: 3.5 } });
    expect(() => validateInvocationSchema('http_api', schema)).toThrow('consecutive_failures must be an integer between 1 and 50');
  });
});
