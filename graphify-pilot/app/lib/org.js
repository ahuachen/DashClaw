/**
 * Multi-tenant org helpers.
 * Reads org context injected by middleware via request headers.
 */

export function getOrgId(request) {
  return request.headers.get('x-org-id') || 'org_default';
}

export function getOrgRole(request) {
  return request.headers.get('x-org-role') || 'member';
}

export function getUserId(request) {
  return request.headers.get('x-user-id') || '';
}
