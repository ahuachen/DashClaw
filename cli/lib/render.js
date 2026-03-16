/**
 * Terminal rendering helpers for DashClaw CLI.
 * Uses only ANSI escape codes — no external dependencies.
 */

const ESC = '\x1b[';

export function bold(str) {
  return `${ESC}1m${str}${ESC}0m`;
}

export function dim(str) {
  return `${ESC}2m${str}${ESC}0m`;
}

export function inverse(str) {
  return `${ESC}7m${str}${ESC}0m`;
}

export function green(str) {
  return `${ESC}32m${str}${ESC}0m`;
}

export function yellow(str) {
  return `${ESC}33m${str}${ESC}0m`;
}

export function red(str) {
  return `${ESC}31m${str}${ESC}0m`;
}

export function colorByRisk(score) {
  if (score >= 70) return red(String(score));
  if (score >= 40) return yellow(String(score));
  return green(String(score));
}

export function clearScreen() {
  process.stdout.write(`${ESC}2J${ESC}H`);
}

export function moveCursor(row, col) {
  process.stdout.write(`${ESC}${row};${col}H`);
}

export function hideCursor() {
  process.stdout.write(`${ESC}?25l`);
}

export function showCursor() {
  process.stdout.write(`${ESC}?25h`);
}

export function printApprovalBlock(action, baseUrl) {
  const actionId = action.action_id || action.id || 'unknown';
  const actionType = action.action_type || 'unknown';
  const riskScore = action.risk_score != null ? String(action.risk_score) : '-';
  const goal = action.declared_goal || '-';
  const agentId = action.agent_id || '-';
  const replayUrl = `${baseUrl}/replay/${actionId}`;

  const lines = [
    '\u2554\u2550\u2550 DashClaw Approval Required \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557',
    `  Action ID:   ${actionId}`,
    `  Agent:       ${agentId}`,
    `  Action:      ${actionType}`,
    '  Policy:      require_approval',
    `  Risk Score:  ${riskScore}`,
    `  Goal:        ${goal}`,
    '',
    `  Replay:      ${replayUrl}`,
    '',
    '  Waiting for approval... (Ctrl+C to abort)',
    '\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d',
  ];
  process.stdout.write('\n' + lines.join('\n') + '\n\n');
}
