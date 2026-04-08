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
          python: {
            canonical_root: 'capabilities',
            required_methods: [],
          },
        },
        'release-plan': {
          node: { current_version: '2.10.0', next_bump: 'minor' },
          python: { current_version: '2.10.0', next_bump: 'none' },
        },
      },
    }, {
      nodeMethods: ['invoke'],
      pythonMethods: [],
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
          python: {
            canonical_root: 'capabilities',
            required_methods: [],
          },
        },
        'release-plan': {
          node: { current_version: '2.9.0', next_bump: 'minor' },
          python: { current_version: '2.10.0', next_bump: 'none' },
        },
      },
    }, {
      nodeMethods: ['invoke'],
      pythonMethods: [],
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
          python: {
            canonical_root: 'capabilities',
            required_methods: [],
          },
        },
        'release-plan': {
          node: { current_version: '2.10.0', next_bump: 'minor' },
          python: { current_version: '2.10.0', next_bump: 'none' },
        },
      },
    }, {
      nodeMethods: ['invoke', 'test'],
      pythonMethods: [],
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
          python: {
            canonical_root: 'capabilities',
            required_methods: [],
          },
        },
        'release-plan': {
          node: { current_version: '2.10.0', next_bump: 'minor' },
          python: { current_version: '2.10.0', next_bump: 'none' },
        },
      },
    }, {
      nodeMethods: ['list', 'invoke', 'test'],
      pythonMethods: [],
      nodeVersion: '2.10.0',
      pythonVersion: '2.10.0',
    });

    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it('fails when required Python public methods are missing', async () => {
    const result = await checkSdkSurface({
      sdk: {
        'public-surface': {
          node: {
            canonical_root: 'execution.capabilities',
            required_methods: ['invoke'],
          },
          python: {
            canonical_root: 'capabilities',
            required_methods: ['list_capabilities', 'invoke_capability', 'get_capability_history'],
          },
        },
        'release-plan': {
          node: { current_version: '2.10.0', next_bump: 'minor' },
          python: { current_version: '2.10.0', next_bump: 'minor' },
        },
      },
    }, {
      nodeMethods: ['invoke'],
      pythonMethods: ['list_capabilities', 'invoke_capability'],
      nodeVersion: '2.10.0',
      pythonVersion: '2.10.0',
    });

    expect(result.ok).toBe(false);
    expect(result.findings[0].code).toBe('missing_python_sdk_method');
    expect(result.findings[0].message).toMatch(/get_capability_history/i);
  });

  it('fails when the discovered Python public surface has undeclared methods', async () => {
    const result = await checkSdkSurface({
      sdk: {
        'public-surface': {
          node: {
            canonical_root: 'execution.capabilities',
            required_methods: ['invoke'],
          },
          python: {
            canonical_root: 'capabilities',
            required_methods: ['invoke_capability'],
          },
        },
        'release-plan': {
          node: { current_version: '2.10.0', next_bump: 'minor' },
          python: { current_version: '2.10.0', next_bump: 'minor' },
        },
      },
    }, {
      nodeMethods: ['invoke'],
      pythonMethods: ['invoke_capability', 'test_capability'],
      nodeVersion: '2.10.0',
      pythonVersion: '2.10.0',
    });

    expect(result.ok).toBe(false);
    expect(result.findings[0].code).toBe('undeclared_python_sdk_method');
    expect(result.findings[0].message).toMatch(/test_capability/i);
  });

  it('passes when required Python methods and release-plan versions are aligned', async () => {
    const result = await checkSdkSurface({
      sdk: {
        'public-surface': {
          node: {
            canonical_root: 'execution.capabilities',
            required_methods: ['invoke'],
          },
          python: {
            canonical_root: 'capabilities',
            required_methods: [
              'list_capabilities',
              'create_capability',
              'get_capability',
              'update_capability',
              'invoke_capability',
              'test_capability',
              'get_capability_health',
              'list_capability_health',
              'get_capability_history',
            ],
          },
        },
        'release-plan': {
          node: { current_version: '2.10.0', next_bump: 'minor' },
          python: { current_version: '2.10.0', next_bump: 'minor' },
        },
      },
    }, {
      nodeMethods: ['invoke'],
      pythonMethods: [
        'list_capabilities',
        'create_capability',
        'get_capability',
        'update_capability',
        'invoke_capability',
        'test_capability',
        'get_capability_health',
        'list_capability_health',
        'get_capability_history',
      ],
      nodeVersion: '2.10.0',
      pythonVersion: '2.10.0',
    });

    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
  });
});
