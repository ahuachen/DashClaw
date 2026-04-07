import { describe, expect, it } from 'vitest';
import { checkSdkSurface } from '../../scripts/lib/contracts/check-sdk-surface.mjs';

describe('checkSdkSurface', () => {
  it('fails when required Node public methods are missing', async () => {
    const result = await checkSdkSurface({
      sdk: {
        'public-surface': {
          node: {
            canonical_root: 'execution.capabilities',
            required_methods: ['invoke', 'test'],
          },
        },
        'release-plan': {
          node: { current_version: '2.10.0', next_bump: 'minor' },
          python: { current_version: '2.10.0', next_bump: 'none' },
        },
      },
    }, {
      nodeMethods: ['invoke'],
      nodeVersion: '2.10.0',
      pythonVersion: '2.10.0',
    });

    expect(result.ok).toBe(false);
    expect(result.findings[0].code).toBe('missing_node_sdk_method');
    expect(result.findings[0].message).toMatch(/test/i);
  });

  it('fails when the release plan version does not match the published SDK version', async () => {
    const result = await checkSdkSurface({
      sdk: {
        'public-surface': {
          node: {
            canonical_root: 'execution.capabilities',
            required_methods: ['invoke'],
          },
        },
        'release-plan': {
          node: { current_version: '2.9.0', next_bump: 'minor' },
          python: { current_version: '2.10.0', next_bump: 'none' },
        },
      },
    }, {
      nodeMethods: ['invoke'],
      nodeVersion: '2.10.0',
      pythonVersion: '2.10.0',
    });

    expect(result.ok).toBe(false);
    expect(result.findings[0].code).toBe('node_release_plan_version_mismatch');
  });

  it('fails when the discovered Node public surface has undeclared methods', async () => {
    const result = await checkSdkSurface({
      sdk: {
        'public-surface': {
          node: {
            canonical_root: 'execution.capabilities',
            required_methods: ['invoke'],
          },
        },
        'release-plan': {
          node: { current_version: '2.10.0', next_bump: 'minor' },
          python: { current_version: '2.10.0', next_bump: 'none' },
        },
      },
    }, {
      nodeMethods: ['invoke', 'test'],
      nodeVersion: '2.10.0',
      pythonVersion: '2.10.0',
    });

    expect(result.ok).toBe(false);
    expect(result.findings[0].code).toBe('undeclared_node_sdk_method');
    expect(result.findings[0].message).toMatch(/test/i);
  });

  it('passes when required methods and release-plan versions are aligned', async () => {
    const result = await checkSdkSurface({
      sdk: {
        'public-surface': {
          node: {
            canonical_root: 'execution.capabilities',
            required_methods: ['list', 'invoke', 'test'],
          },
        },
        'release-plan': {
          node: { current_version: '2.10.0', next_bump: 'minor' },
          python: { current_version: '2.10.0', next_bump: 'none' },
        },
      },
    }, {
      nodeMethods: ['list', 'invoke', 'test'],
      nodeVersion: '2.10.0',
      pythonVersion: '2.10.0',
    });

    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
  });
});
