/**
 * Security scanning utility for detecting sensitive data.
 * Ported from outbound_filter for use in API routes.
 */

export const SECURITY_PATTERNS = [
  { name: 'api_key_generic', pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]?([A-Za-z0-9_\-]{16,})['"]?/gi, category: 'api_key', severity: 'critical' },
  { name: 'aws_access_key', pattern: /AKIA[0-9A-Z]{16}/g, category: 'cloud_credential', severity: 'critical' },
  { name: 'aws_secret_key', pattern: /(?:aws)?[_-]?secret[_-]?(?:access)?[_-]?key\s*[:=]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/gi, category: 'cloud_credential', severity: 'critical' },
  { name: 'github_token', pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g, category: 'token', severity: 'critical' },
  { name: 'openai_key', pattern: /sk-[A-Za-z0-9]{20,}/g, category: 'api_key', severity: 'critical' },
  { name: 'anthropic_key', pattern: /sk-ant-[A-Za-z0-9_\-]{20,}/g, category: 'api_key', severity: 'critical' },
  { name: 'stripe_key', pattern: /(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{24,}/g, category: 'api_key', severity: 'critical' },
  { name: 'slack_token', pattern: /xox[bpsar]-[A-Za-z0-9\-]{10,}/g, category: 'token', severity: 'critical' },
  { name: 'jwt_token', pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, category: 'token', severity: 'high' },
  { name: 'private_key', pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g, category: 'private_key', severity: 'critical' },
  { name: 'password_field', pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"]([^'"]{6,})['"]?/gi, category: 'password', severity: 'high' },
  { name: 'bearer_token', pattern: /Bearer\s+[A-Za-z0-9_\-\.]{20,}/g, category: 'token', severity: 'high' },
  { name: 'database_url', pattern: /(?:postgres|mysql|mongodb|redis):\/\/[^\s'"]{10,}/gi, category: 'connection_string', severity: 'critical' },
];

/**
 * Scans text for sensitive data.
 * @returns { findings: Array, redacted: string, clean: boolean }
 */
export function scanSensitiveData(text) {
  if (!text || typeof text !== 'string') return { findings: [], redacted: text, clean: true };

  const findings = [];
  let redacted = text;

  for (const { name, pattern, category, severity } of SECURITY_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      findings.push({ pattern: name, category, severity, preview: match[0].substring(0, 8) + '***' });
      redacted = redacted.replace(match[0], `[REDACTED:${name}]`);
    }
  }

  return { findings, redacted, clean: findings.length === 0 };
}
