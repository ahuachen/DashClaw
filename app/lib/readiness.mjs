/**
 * Canonical readiness and verification checks for the /setup page.
 * Repackaged into modular files under app/lib/readiness/
 */

import { getSetupStatus } from './setupStatus.mjs';
import { getAuthConfig } from './authConfig.mjs';

import { REQUIRED_ENV_VARS, ADVISORY_ENV_VARS } from './readiness/constants.mjs';
import { buildApplicationSection } from './readiness/applicationCheck.mjs';
import { buildDatabaseSection } from './readiness/databaseCheck.mjs';
import { checkConfiguration, buildConfigurationSection } from './readiness/configurationCheck.mjs';
import { buildAuthSection } from './readiness/authCheck.mjs';
import { getSdkCommands, projectConnectNextStep, buildSdkSection } from './readiness/sdkCheck.mjs';
import { buildWorkflow, buildRecommendations, buildVerificationState, buildProofArtifact, projectAuthConfig, projectCheck, projectStep } from './readiness/workflow.mjs';

export { REQUIRED_ENV_VARS, ADVISORY_ENV_VARS, getSdkCommands, projectConnectNextStep };

export async function getReadinessReport(env = process.env, options = {}) {
  const { host = '', liveProof = null } = options;

  const [dbStatus, authConfig, config] = await Promise.all([
    getSetupStatus(env),
    Promise.resolve(getAuthConfig(env)),
    Promise.resolve(checkConfiguration(env)),
  ]);

  const application = buildApplicationSection(env);
  const db = buildDatabaseSection(dbStatus);
  const configuration = buildConfigurationSection(config);
  const auth = buildAuthSection(authConfig, env);
  const baseReport = {
    checkedAt: new Date().toISOString(),
    application,
    db,
    config: configuration,
    auth,
  };

  const sdk = buildSdkSection(host, baseReport, liveProof);
  const sections = [application, db, configuration, auth, sdk];

  let overall = 'healthy';
  if (!db.ok || !configuration.ok) {
    overall = 'blocked';
  } else if (!auth.ok || configuration.missingAdvisory.length > 0 || auth.status === 'warn') {
    overall = 'needs_attention';
  }

  const report = {
    overall,
    checkedAt: baseReport.checkedAt,
    application,
    db,
    config: configuration,
    auth,
    sdk,
    sections,
  };

  const verification = buildVerificationState(report);

  return {
    ...report,
    verification,
    workflow: buildWorkflow(report),
    recommendations: buildRecommendations(report),
  };
}


export function projectReadinessReport(report, { isAuthenticated = false, host = '' } = {}) {
  const projectedSections = report.sections.map((section) => ({
    ...section,
    checks: section.checks.map((check) => projectCheck(check, isAuthenticated)),
  }));

  const projectedSdk = projectedSections.find((section) => section.id === 'sdk') || report.sdk;
  const view = {
    ...report,
    isAuthenticated,
    mode: isAuthenticated ? 'operator' : 'public',
    notice: isAuthenticated
      ? ''
      : 'This page is intentionally safe to open before login. Some operator details stay hidden until you sign in.',
    db: {
      ...report.db,
      missing: isAuthenticated ? report.db.missing : [],
    },
    auth: projectAuthConfig(report.auth, isAuthenticated),
    sdk: projectedSdk,
    sections: projectedSections,
    workflow: report.workflow.map((step) => ({ ...step })),
    recommendations: report.recommendations.map((step) => projectStep(step, isAuthenticated)),
  };

  return {
    ...view,
    proofArtifact: buildProofArtifact(view, host),
  };
}


