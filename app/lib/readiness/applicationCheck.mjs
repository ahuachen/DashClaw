import { createSection, createCheck } from './factories.mjs';

export function buildApplicationSection(env) {
  const mode = env.NODE_ENV || 'development';

  return createSection({
    id: 'application',
    title: 'Core Readiness',
    status: 'pass',
    description: 'Confirms that DashClaw is serving the verify surface and the app process is alive.',
    summary: 'DashClaw responded to the verification request.',
    whatWasChecked: 'The /setup page rendered and the server runtime reported process metadata.',
    evidenceSummary: 'Behavior verified: the app process responded and exposed runtime metadata.',
    pendingProof: '',
    checks: [
      createCheck({
        id: 'app_reachable',
        label: 'Verify surface reachable',
        status: 'pass',
        detail: 'The Setup & Verify page rendered successfully.',
      }),
      createCheck({
        id: 'runtime',
        label: 'Runtime metadata',
        status: 'pass',
        detail: `Node.js ${process.version} running in ${mode}.`,
        publicDetail: 'Application runtime is available.',
      }),
    ],
    ok: true,
  });
}
