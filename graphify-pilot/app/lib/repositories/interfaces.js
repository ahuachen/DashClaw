/**
 * Repository interface contracts for WS1 domain migration.
 * These contracts define required method names per domain.
 */

export const REPOSITORY_INTERFACES = {
  actions: [
    'listActions',
    'getActionById',
    'createAction',
    'updateActionOutcome',
    'deleteActions',
    'listActionAssumptions',
    'upsertActionAssumption',
    'listOpenLoops',
    'upsertOpenLoop',
  ],
  orgsTeam: [
    'listOrganizationsForUser',
    'getOrganizationById',
    'updateOrganization',
    'listOrgApiKeys',
    'createOrgApiKey',
    'revokeOrgApiKey',
    'listTeamMembers',
    'updateTeamMemberRole',
    'removeTeamMember',
    'createTeamInvite',
    'listTeamInvites',
    'revokeTeamInvite',
  ],
  messagesContext: [
    'listMessages',
    'createMessage',
    'markMessagesRead',
    'archiveMessages',
    'listMessageThreads',
    'createMessageThread',
    'updateMessageThread',
    'listContextPoints',
    'createContextPoint',
    'listContextThreads',
    'createContextThread',
    'updateContextThread',
    'createContextThreadEntry',
    'listHandoffs',
    'createHandoff',
  ],
};

export function getRepositoryInterface(name) {
  return REPOSITORY_INTERFACES[name] || [];
}

export function validateRepositoryImplementation(name, implementation) {
  const required = getRepositoryInterface(name);
  if (!required.length) {
    return { valid: false, missing: [], unknown: true };
  }

  const missing = required.filter((method) => typeof implementation?.[method] !== 'function');
  return {
    valid: missing.length === 0,
    missing,
    unknown: false,
  };
}
