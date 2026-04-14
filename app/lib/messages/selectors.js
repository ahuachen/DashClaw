/**
 * selectUrgentUnread — pure selector for the Mission Control Recent Comms card.
 *
 * Keeps only sent+unread messages, sorts urgent ahead of normal, then newest first.
 * @param {Array} messages  Raw list from /api/messages?direction=inbox
 * @param {{limit?: number}} opts
 * @returns {Array}
 */
export function selectUrgentUnread(messages, opts = {}) {
  const { limit = 5 } = opts;
  if (!Array.isArray(messages)) return [];

  const unread = messages.filter(m => m && m.status === 'sent' && !m.is_read);

  unread.sort((a, b) => {
    const ua = a.urgent === 1 ? 1 : 0;
    const ub = b.urgent === 1 ? 1 : 0;
    if (ua !== ub) return ub - ua;
    const ta = new Date(a.created_at || 0).getTime();
    const tb = new Date(b.created_at || 0).getTime();
    return tb - ta;
  });

  return unread.slice(0, limit);
}
