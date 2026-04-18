export function isHostedMode() {
  return process.env.DASHCLAW_HOSTED === 'true';
}

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function hostedConfig() {
  return {
    trialDays: parsePositiveInt(process.env.HOSTED_TRIAL_DAYS, 30),
    trialActionCap: parsePositiveInt(process.env.HOSTED_TRIAL_ACTION_CAP, 10000),
    maxProvisionsPerIpPerDay: parsePositiveInt(process.env.HOSTED_PROVISION_MAX_PER_IP_PER_DAY, 5),
  };
}
