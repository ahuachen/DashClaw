/**
 * Jest test generator
 * Absorbed from dashclaw-guardrails/packages/guardrailgen-js/src/generators/jest.js
 */

export function generateJestTests(policyDoc) {
  const { project, policies } = policyDoc;

  let output = `// Auto-generated guardrails tests for: ${project || 'unknown'}\n// DO NOT EDIT - regenerate with guardrailgen\n\nimport { evaluatePolicy } from './src/evaluator.js';\n\n`;

  for (const policy of policies) {
    output += generatePolicyTestSuite(policy);
  }

  return output;
}

function generatePolicyTestSuite(policy) {
  const { id, tests } = policy;

  let suite = `describe('guardrails: ${id}', () => {\n  const policy = ${JSON.stringify(policy, null, 2)};\n\n`;

  if (!tests || tests.length === 0) {
    suite += `  test.skip('no tests defined', () => {});\n`;
  } else {
    for (const testCase of tests) {
      suite += generateTestCase(testCase);
    }
  }

  suite += `});\n\n`;
  return suite;
}

function generateTestCase(testCase) {
  const { name, input, expect: expected } = testCase;

  let test = `  test('${name}', () => {\n    const input = ${JSON.stringify(input, null, 4).replace(/^/gm, '    ')};\n    const result = evaluatePolicy(policy, input);\n    expect(result.allowed).toBe(${expected.allowed});\n`;

  if (expected.reason) {
    test += `    expect(result.reason).toMatch(/${expected.reason}/i);\n`;
  }

  test += `  });\n\n`;
  return test;
}

export function generatePackageJson(projectName) {
  return JSON.stringify({
    name: `${projectName}-guardrails-tests`,
    version: '1.0.0',
    type: 'module',
    scripts: { test: 'node --experimental-vm-modules node_modules/jest/bin/jest.js' },
    devDependencies: { jest: '^29.7.0' }
  }, null, 2);
}

export function generateJestConfig() {
  return `export default {\n  testEnvironment: 'node',\n  transform: {},\n  testMatch: ['**/*.test.js'],\n  collectCoverageFrom: ['src/**/*.js'],\n};\n`;
}
