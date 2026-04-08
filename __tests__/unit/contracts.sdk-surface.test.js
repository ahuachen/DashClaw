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
            domains: {
              capabilities: {
                canonical_root: 'capabilities',
                required_methods: [],
              },
              workflows: {
                canonical_root: 'workflows',
                required_methods: [],
              },
              model_strategies: {
                canonical_root: 'model_strategies',
                required_methods: [],
              },
              knowledge: {
                canonical_root: 'knowledge',
                required_methods: [],
              },
            },
          },
        },
        'release-plan': {
          node: { current_version: '2.10.0', next_bump: 'minor' },
          python: { current_version: '2.10.0', next_bump: 'none' },
        },
      },
    }, {
      nodeMethods: ['invoke'],
      pythonMethods: { capabilities: [], workflows: [], model_strategies: [], knowledge: [] },
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
            domains: {
              capabilities: {
                canonical_root: 'capabilities',
                required_methods: [],
              },
              workflows: {
                canonical_root: 'workflows',
                required_methods: [],
              },
              model_strategies: {
                canonical_root: 'model_strategies',
                required_methods: [],
              },
              knowledge: {
                canonical_root: 'knowledge',
                required_methods: [],
              },
            },
          },
        },
        'release-plan': {
          node: { current_version: '2.9.0', next_bump: 'minor' },
          python: { current_version: '2.10.0', next_bump: 'none' },
        },
      },
    }, {
      nodeMethods: ['invoke'],
      pythonMethods: { capabilities: [], workflows: [], model_strategies: [], knowledge: [] },
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
            domains: {
              capabilities: {
                canonical_root: 'capabilities',
                required_methods: [],
              },
              workflows: {
                canonical_root: 'workflows',
                required_methods: [],
              },
              model_strategies: {
                canonical_root: 'model_strategies',
                required_methods: [],
              },
              knowledge: {
                canonical_root: 'knowledge',
                required_methods: [],
              },
            },
          },
        },
        'release-plan': {
          node: { current_version: '2.10.0', next_bump: 'minor' },
          python: { current_version: '2.10.0', next_bump: 'none' },
        },
      },
    }, {
      nodeMethods: ['invoke', 'test'],
      pythonMethods: { capabilities: [], workflows: [], model_strategies: [], knowledge: [] },
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
            domains: {
              capabilities: {
                canonical_root: 'capabilities',
                required_methods: [],
              },
              workflows: {
                canonical_root: 'workflows',
                required_methods: [],
              },
              model_strategies: {
                canonical_root: 'model_strategies',
                required_methods: [],
              },
              knowledge: {
                canonical_root: 'knowledge',
                required_methods: [],
              },
            },
          },
        },
        'release-plan': {
          node: { current_version: '2.10.0', next_bump: 'minor' },
          python: { current_version: '2.10.0', next_bump: 'none' },
        },
      },
    }, {
      nodeMethods: ['list', 'invoke', 'test'],
      pythonMethods: { capabilities: [], workflows: [], model_strategies: [], knowledge: [] },
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
            domains: {
              capabilities: {
                canonical_root: 'capabilities',
                required_methods: ['list_capabilities', 'invoke_capability', 'get_capability_history'],
              },
              workflows: {
                canonical_root: 'workflows',
                required_methods: [],
              },
              model_strategies: {
                canonical_root: 'model_strategies',
                required_methods: [],
              },
              knowledge: {
                canonical_root: 'knowledge',
                required_methods: [],
              },
            },
          },
        },
        'release-plan': {
          node: { current_version: '2.10.0', next_bump: 'minor' },
          python: { current_version: '2.10.0', next_bump: 'minor' },
        },
      },
    }, {
      nodeMethods: ['invoke'],
      pythonMethods: {
        capabilities: ['list_capabilities', 'invoke_capability'],
        workflows: [],
        model_strategies: [],
        knowledge: [],
      },
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
            domains: {
              capabilities: {
                canonical_root: 'capabilities',
                required_methods: ['invoke_capability'],
              },
              workflows: {
                canonical_root: 'workflows',
                required_methods: [],
              },
              model_strategies: {
                canonical_root: 'model_strategies',
                required_methods: [],
              },
              knowledge: {
                canonical_root: 'knowledge',
                required_methods: [],
              },
            },
          },
        },
        'release-plan': {
          node: { current_version: '2.10.0', next_bump: 'minor' },
          python: { current_version: '2.10.0', next_bump: 'minor' },
        },
      },
    }, {
      nodeMethods: ['invoke'],
      pythonMethods: {
        capabilities: ['invoke_capability', 'test_capability'],
        workflows: [],
        model_strategies: [],
        knowledge: [],
      },
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
            domains: {
              capabilities: {
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
              workflows: {
                canonical_root: 'workflows',
                required_methods: [],
              },
              model_strategies: {
                canonical_root: 'model_strategies',
                required_methods: [],
              },
              knowledge: {
                canonical_root: 'knowledge',
                required_methods: [],
              },
            },
          },
        },
        'release-plan': {
          node: { current_version: '2.10.0', next_bump: 'minor' },
          python: { current_version: '2.10.0', next_bump: 'minor' },
        },
      },
    }, {
      nodeMethods: ['invoke'],
      pythonMethods: {
        capabilities: [
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
        workflows: [],
        model_strategies: [],
        knowledge: [],
      },
      nodeVersion: '2.10.0',
      pythonVersion: '2.10.0',
    });

    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it('fails when required Python workflow methods are missing', async () => {
    const result = await checkSdkSurface({
      sdk: {
        'public-surface': {
          node: {
            canonical_root: 'execution.capabilities',
            required_methods: ['invoke'],
          },
          python: {
            domains: {
              capabilities: {
                canonical_root: 'capabilities',
                required_methods: ['invoke_capability'],
              },
              workflows: {
                canonical_root: 'workflows',
                required_methods: [
                  'list_workflow_templates',
                  'launch_workflow_template',
                  'execute_workflow_template',
                ],
              },
              model_strategies: {
                canonical_root: 'model_strategies',
                required_methods: [],
              },
              knowledge: {
                canonical_root: 'knowledge',
                required_methods: [],
              },
            },
          },
        },
        'release-plan': {
          node: { current_version: '2.10.0', next_bump: 'minor' },
          python: { current_version: '2.10.0', next_bump: 'minor' },
        },
      },
    }, {
      nodeMethods: ['invoke'],
      pythonMethods: {
        capabilities: ['invoke_capability'],
        workflows: ['list_workflow_templates', 'launch_workflow_template'],
        model_strategies: [],
        knowledge: [],
      },
      nodeVersion: '2.10.0',
      pythonVersion: '2.10.0',
    });

    expect(result.ok).toBe(false);
    expect(result.findings[0].code).toBe('missing_python_sdk_method');
    expect(result.findings[0].message).toMatch(/execute_workflow_template/i);
  });

  it('fails when the discovered Python workflow surface has undeclared methods', async () => {
    const result = await checkSdkSurface({
      sdk: {
        'public-surface': {
          node: {
            canonical_root: 'execution.capabilities',
            required_methods: ['invoke'],
          },
          python: {
            domains: {
              capabilities: {
                canonical_root: 'capabilities',
                required_methods: ['invoke_capability'],
              },
              workflows: {
                canonical_root: 'workflows',
                required_methods: ['launch_workflow_template'],
              },
              model_strategies: {
                canonical_root: 'model_strategies',
                required_methods: [],
              },
              knowledge: {
                canonical_root: 'knowledge',
                required_methods: [],
              },
            },
          },
        },
        'release-plan': {
          node: { current_version: '2.10.0', next_bump: 'minor' },
          python: { current_version: '2.10.0', next_bump: 'minor' },
        },
      },
    }, {
      nodeMethods: ['invoke'],
      pythonMethods: {
        capabilities: ['invoke_capability'],
        workflows: ['launch_workflow_template', 'execute_workflow_template'],
        model_strategies: [],
        knowledge: [],
      },
      nodeVersion: '2.10.0',
      pythonVersion: '2.10.0',
    });

    expect(result.ok).toBe(false);
    expect(result.findings[0].code).toBe('undeclared_python_sdk_method');
    expect(result.findings[0].message).toMatch(/execute_workflow_template/i);
  });

  it('fails when required Python model strategy methods are missing', async () => {
    const result = await checkSdkSurface({
      sdk: {
        'public-surface': {
          node: {
            canonical_root: 'execution.capabilities',
            required_methods: ['invoke'],
          },
          python: {
            domains: {
              capabilities: {
                canonical_root: 'capabilities',
                required_methods: ['invoke_capability'],
              },
              workflows: {
                canonical_root: 'workflows',
                required_methods: ['execute_workflow_template'],
              },
              model_strategies: {
                canonical_root: 'model_strategies',
                required_methods: [
                  'list_model_strategies',
                  'complete_with_strategy',
                ],
              },
              knowledge: {
                canonical_root: 'knowledge',
                required_methods: [],
              },
            },
          },
        },
        'release-plan': {
          node: { current_version: '2.10.0', next_bump: 'minor' },
          python: { current_version: '2.10.0', next_bump: 'minor' },
        },
      },
    }, {
      nodeMethods: ['invoke'],
      pythonMethods: {
        capabilities: ['invoke_capability'],
        workflows: ['execute_workflow_template'],
        model_strategies: ['list_model_strategies'],
        knowledge: [],
      },
      nodeVersion: '2.10.0',
      pythonVersion: '2.10.0',
    });

    expect(result.ok).toBe(false);
    expect(result.findings[0].code).toBe('missing_python_sdk_method');
    expect(result.findings[0].message).toMatch(/complete_with_strategy/i);
  });

  it('fails when the discovered Python model strategy surface has undeclared methods', async () => {
    const result = await checkSdkSurface({
      sdk: {
        'public-surface': {
          node: {
            canonical_root: 'execution.capabilities',
            required_methods: ['invoke'],
          },
          python: {
            domains: {
              capabilities: {
                canonical_root: 'capabilities',
                required_methods: ['invoke_capability'],
              },
              workflows: {
                canonical_root: 'workflows',
                required_methods: ['execute_workflow_template'],
              },
              model_strategies: {
                canonical_root: 'model_strategies',
                required_methods: ['list_model_strategies'],
              },
              knowledge: {
                canonical_root: 'knowledge',
                required_methods: [],
              },
            },
          },
        },
        'release-plan': {
          node: { current_version: '2.10.0', next_bump: 'minor' },
          python: { current_version: '2.10.0', next_bump: 'minor' },
        },
      },
    }, {
      nodeMethods: ['invoke'],
      pythonMethods: {
        capabilities: ['invoke_capability'],
        workflows: ['execute_workflow_template'],
        model_strategies: ['list_model_strategies', 'complete_with_strategy'],
        knowledge: [],
      },
      nodeVersion: '2.10.0',
      pythonVersion: '2.10.0',
    });

    expect(result.ok).toBe(false);
    expect(result.findings[0].code).toBe('undeclared_python_sdk_method');
    expect(result.findings[0].message).toMatch(/complete_with_strategy/i);
  });

  it('fails when required Python knowledge methods are missing', async () => {
    const result = await checkSdkSurface({
      sdk: {
        'public-surface': {
          node: {
            canonical_root: 'execution.capabilities',
            required_methods: ['invoke'],
          },
          python: {
            domains: {
              capabilities: {
                canonical_root: 'capabilities',
                required_methods: ['invoke_capability'],
              },
              workflows: {
                canonical_root: 'workflows',
                required_methods: ['execute_workflow_template'],
              },
              model_strategies: {
                canonical_root: 'model_strategies',
                required_methods: ['complete_with_strategy'],
              },
              knowledge: {
                canonical_root: 'knowledge',
                required_methods: [
                  'list_knowledge_collections',
                  'search_knowledge_collection',
                ],
              },
            },
          },
        },
        'release-plan': {
          node: { current_version: '2.10.0', next_bump: 'minor' },
          python: { current_version: '2.10.0', next_bump: 'minor' },
        },
      },
    }, {
      nodeMethods: ['invoke'],
      pythonMethods: {
        capabilities: ['invoke_capability'],
        workflows: ['execute_workflow_template'],
        model_strategies: ['complete_with_strategy'],
        knowledge: ['list_knowledge_collections'],
      },
      nodeVersion: '2.10.0',
      pythonVersion: '2.10.0',
    });

    expect(result.ok).toBe(false);
    expect(result.findings[0].code).toBe('missing_python_sdk_method');
    expect(result.findings[0].message).toMatch(/search_knowledge_collection/i);
  });

  it('fails when the discovered Python knowledge surface has undeclared methods', async () => {
    const result = await checkSdkSurface({
      sdk: {
        'public-surface': {
          node: {
            canonical_root: 'execution.capabilities',
            required_methods: ['invoke'],
          },
          python: {
            domains: {
              capabilities: {
                canonical_root: 'capabilities',
                required_methods: ['invoke_capability'],
              },
              workflows: {
                canonical_root: 'workflows',
                required_methods: ['execute_workflow_template'],
              },
              model_strategies: {
                canonical_root: 'model_strategies',
                required_methods: ['complete_with_strategy'],
              },
              knowledge: {
                canonical_root: 'knowledge',
                required_methods: ['list_knowledge_collections'],
              },
            },
          },
        },
        'release-plan': {
          node: { current_version: '2.10.0', next_bump: 'minor' },
          python: { current_version: '2.10.0', next_bump: 'minor' },
        },
      },
    }, {
      nodeMethods: ['invoke'],
      pythonMethods: {
        capabilities: ['invoke_capability'],
        workflows: ['execute_workflow_template'],
        model_strategies: ['complete_with_strategy'],
        knowledge: ['list_knowledge_collections', 'search_knowledge_collection'],
      },
      nodeVersion: '2.10.0',
      pythonVersion: '2.10.0',
    });

    expect(result.ok).toBe(false);
    expect(result.findings[0].code).toBe('undeclared_python_sdk_method');
    expect(result.findings[0].message).toMatch(/search_knowledge_collection/i);
  });
});
