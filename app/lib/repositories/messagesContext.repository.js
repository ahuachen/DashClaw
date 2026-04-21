export async function listMessages(sql, orgId, filters = {}) {
  const {
    agentId,
    direction = 'inbox',
    type,
    unread,
    threadId,
    limit = 50,
    offset = 0,
  } = filters;

  const conditions = ['org_id = $1'];
  const params = [orgId];
  let idx = 2;

  if (agentId) {
    if (direction === 'sent') {
      conditions.push(`from_agent_id = $${idx}`);
      params.push(agentId);
      idx++;
    } else if (direction === 'inbox') {
      conditions.push(`(to_agent_id = $${idx} OR to_agent_id IS NULL)`);
      params.push(agentId);
      idx++;
      conditions.push(`from_agent_id != $${idx}`);
      params.push(agentId);
      idx++;
    } else {
      conditions.push(`(from_agent_id = $${idx} OR to_agent_id = $${idx} OR to_agent_id IS NULL)`);
      params.push(agentId);
      idx++;
    }
  }

  if (direction === 'inbox') {
    conditions.push("status != 'archived'");
  }
  if (type) {
    conditions.push(`message_type = $${idx}`);
    params.push(type);
    idx++;
  }
  if (unread === true) {
    conditions.push("status = 'sent'");
  }
  if (threadId) {
    conditions.push(`thread_id = $${idx}`);
    params.push(threadId);
    idx++;
  }

  const where = conditions.join(' AND ');
  const rows = await sql.query(
    `SELECT * FROM agent_messages WHERE ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return rows;
}

export async function getUnreadMessageCount(sql, orgId, agentId = null) {
  const readerId = agentId || 'dashboard';
  if (agentId) {
    const countResult = await sql.query(
      `SELECT COUNT(*)::int as count FROM agent_messages
       WHERE org_id = $1
         AND (to_agent_id = $2 OR to_agent_id IS NULL)
         AND from_agent_id != $2
         AND status = 'sent'
         AND (to_agent_id IS NOT NULL OR read_by IS NULL OR NOT (read_by::text LIKE '%' || $3 || '%'))`,
      [orgId, agentId, `"${readerId}"`]
    );
    return countResult[0]?.count || 0;
  }

  const likePattern = `%"${readerId}"%`;
  const countResult = await sql`
    SELECT COUNT(*)::int as count FROM agent_messages
    WHERE org_id = ${orgId}
      AND status = 'sent'
      AND (to_agent_id IS NOT NULL OR read_by IS NULL OR NOT (read_by::text LIKE ${likePattern}))
  `;
  return countResult[0]?.count || 0;
}

export async function getMessageThread(sql, orgId, threadId) {
  const rows = await sql`SELECT id, status FROM message_threads WHERE id = ${threadId} AND org_id = ${orgId}`;
  return rows[0] || null;
}

export async function createMessage(sql, payload) {
  const {
    id,
    orgId,
    thread_id,
    from_agent_id,
    to_agent_id,
    message_type,
    subject,
    body,
    urgent,
    doc_ref,
    now,
  } = payload;

  const rows = await sql`
    INSERT INTO agent_messages (id, org_id, thread_id, from_agent_id, to_agent_id, message_type, subject, body, urgent, status, doc_ref, read_by, created_at)
    VALUES (
      ${id}, ${orgId}, ${thread_id || null}, ${from_agent_id}, ${to_agent_id || null},
      ${message_type}, ${subject || null}, ${body}, ${urgent || false}, 'sent',
      ${doc_ref || null}, ${to_agent_id ? null : '[]'}, ${now}
    )
    RETURNING *
  `;
  return rows[0] || null;
}

export async function touchMessageThread(sql, orgId, threadId, now) {
  await sql`UPDATE message_threads SET updated_at = ${now} WHERE id = ${threadId} AND org_id = ${orgId}`;
}

export async function getMessageForUpdate(sql, orgId, messageId) {
  const rows = await sql`SELECT id, to_agent_id, read_by FROM agent_messages WHERE id = ${messageId} AND org_id = ${orgId}`;
  return rows[0] || null;
}

export async function updateMessageReadBy(sql, orgId, messageId, readBy) {
  await sql`UPDATE agent_messages SET read_by = ${JSON.stringify(readBy)} WHERE id = ${messageId} AND org_id = ${orgId}`;
}

export async function markBroadcastRead(sql, orgId, messageId, readBy) {
  await sql`UPDATE agent_messages SET read_by = ${JSON.stringify(readBy)} WHERE id = ${messageId} AND org_id = ${orgId}`;
}

export async function markMessageRead(sql, orgId, messageId, now) {
  await sql`UPDATE agent_messages SET status = 'read', read_at = ${now} WHERE id = ${messageId} AND org_id = ${orgId} AND status = 'sent'`;
}

export async function archiveMessage(sql, orgId, messageId, now) {
  const rows = await sql`
    UPDATE agent_messages SET status = 'archived', archived_at = ${now}
    WHERE id = ${messageId} AND org_id = ${orgId} AND status != 'archived'
    RETURNING id
  `;
  return rows.length > 0;
}

export async function getMessagesForUpdate(sql, orgId, messageIds) {
  if (!messageIds || messageIds.length === 0) return [];
  return sql`SELECT id, to_agent_id, read_by FROM agent_messages WHERE id = ANY(${messageIds}) AND org_id = ${orgId}`;
}

export async function batchMarkMessagesRead(sql, orgId, messageIds, now) {
  if (!messageIds || messageIds.length === 0) return 0;
  const rows = await sql`
    UPDATE agent_messages SET status = 'read', read_at = ${now}
    WHERE id = ANY(${messageIds}) AND org_id = ${orgId} AND status = 'sent'
    RETURNING id
  `;
  return rows.length;
}

export async function batchArchiveMessages(sql, orgId, messageIds, now) {
  if (!messageIds || messageIds.length === 0) return 0;
  const rows = await sql`
    UPDATE agent_messages SET status = 'archived', archived_at = ${now}
    WHERE id = ANY(${messageIds}) AND org_id = ${orgId} AND status != 'archived'
    RETURNING id
  `;
  return rows.length;
}

// ── Action Message Trail ─────────────────────────────────────

export async function getMessagesByActionId(sql, orgId, actionId) {
  return sql`
    SELECT id, from_agent_id, to_agent_id, message_type, subject, body,
           thread_id, urgent, created_at, action_id
    FROM agent_messages
    WHERE org_id = ${orgId} AND action_id = ${actionId}
    ORDER BY created_at ASC
  `;
}

export async function getMessagesInTimeWindow(sql, orgId, agentId, windowStart, windowEnd) {
  return sql`
    SELECT id, from_agent_id, to_agent_id, message_type, subject, body,
           thread_id, urgent, created_at, action_id
    FROM agent_messages
    WHERE org_id = ${orgId}
      AND (from_agent_id = ${agentId} OR to_agent_id = ${agentId})
      AND created_at::timestamptz >= (${windowStart}::timestamptz - interval '60 seconds')
      AND created_at::timestamptz <= (${windowEnd}::timestamptz + interval '60 seconds')
    ORDER BY created_at ASC
    LIMIT 50
  `;
}

export async function getMessageSummaryByActionId(sql, orgId, actionId) {
  const rows = await sql`
    SELECT
      COUNT(*)::int AS total,
      COALESCE(
        STRING_AGG(DISTINCT from_agent_id, ',') ||
        CASE WHEN STRING_AGG(DISTINCT to_agent_id, ',') IS NOT NULL
          THEN ',' || STRING_AGG(DISTINCT to_agent_id, ',') ELSE '' END,
        ''
      ) AS participants,
      MIN(created_at) AS first_message_at,
      MAX(created_at) AS last_message_at
    FROM agent_messages
    WHERE org_id = ${orgId} AND action_id = ${actionId}
  `;
  return rows[0] || { total: 0, participants: '', first_message_at: null, last_message_at: null };
}

// ── Message Threads (CRUD) ───────────────────────────────────

export async function listThreads(sql, orgId, { status, agentId, limit = 20 } = {}) {
  const conditions = ['t.org_id = $1'];
  const params = [orgId];
  let idx = 2;

  if (status) {
    conditions.push(`t.status = $${idx}`);
    params.push(status);
    idx++;
  }
  if (agentId) {
    conditions.push(`(t.participants ILIKE $${idx} OR t.created_by = $${idx + 1} OR EXISTS (SELECT 1 FROM agent_messages m WHERE m.thread_id = t.id AND (m.from_agent_id = $${idx + 1} OR m.to_agent_id = $${idx + 1})))`);
    params.push(`%${agentId}%`, agentId);
    idx += 2;
  }

  const where = conditions.join(' AND ');
  return sql.query(
    `SELECT t.*,
      (SELECT COUNT(*)::int FROM agent_messages m WHERE m.thread_id = t.id) as message_count,
      (SELECT MAX(m.created_at) FROM agent_messages m WHERE m.thread_id = t.id) as last_message_at
    FROM message_threads t
    WHERE ${where}
    ORDER BY COALESCE((SELECT MAX(m.created_at) FROM agent_messages m WHERE m.thread_id = t.id), t.created_at) DESC
    LIMIT $${idx}`,
    [...params, limit]
  );
}

export async function createThread(sql, orgId, { id, name, participants, created_by, now }) {
  const participantsJson = participants ? JSON.stringify(participants) : null;
  // Idempotent on the client-supplied id so a network-retry with the same
  // thread id reuses the existing row instead of inserting a duplicate
  // message_threads record with a new primary key.
  const rows = await sql`
    INSERT INTO message_threads (id, org_id, name, participants, status, created_by, created_at, updated_at)
    VALUES (${id}, ${orgId}, ${name}, ${participantsJson}, 'open', ${created_by}, ${now}, ${now})
    ON CONFLICT (id) DO NOTHING
    RETURNING *
  `;
  if (rows.length > 0) return rows[0];

  const existing = await sql`
    SELECT * FROM message_threads WHERE id = ${id} AND org_id = ${orgId}
  `;
  return existing[0] || null;
}

export async function getThreadById(sql, orgId, threadId) {
  const rows = await sql`SELECT * FROM message_threads WHERE id = ${threadId} AND org_id = ${orgId}`;
  return rows[0] || null;
}

export async function updateThread(sql, orgId, threadId, { status, summary, resolvedAt, now }) {
  const rows = await sql`
    UPDATE message_threads
    SET status = ${status}, summary = ${summary}, resolved_at = ${resolvedAt}, updated_at = ${now}
    WHERE id = ${threadId} AND org_id = ${orgId}
    RETURNING *
  `;
  return rows[0] || null;
}

// ── Attachments ──────────────────────────────────────────────

export async function createAttachment(sql, payload) {
  const { id, orgId, messageId, filename, mimeType, sizeBytes, data, now } = payload;
  const rows = await sql`
    INSERT INTO message_attachments (id, org_id, message_id, filename, mime_type, size_bytes, data, created_at)
    VALUES (${id}, ${orgId}, ${messageId}, ${filename}, ${mimeType}, ${sizeBytes}, ${data}, ${now})
    RETURNING id, org_id, message_id, filename, mime_type, size_bytes, created_at
  `;
  return rows[0] || null;
}

export async function getAttachmentsForMessages(sql, orgId, messageIds) {
  if (!messageIds || messageIds.length === 0) return [];
  const rows = await sql`
    SELECT id, org_id, message_id, filename, mime_type, size_bytes, created_at
    FROM message_attachments
    WHERE org_id = ${orgId} AND message_id = ANY(${messageIds})
    ORDER BY created_at ASC
  `;
  return rows;
}

export async function getAttachmentWithData(sql, orgId, attachmentId) {
  const rows = await sql`
    SELECT * FROM message_attachments WHERE id = ${attachmentId} AND org_id = ${orgId}
  `;
  return rows[0] || null;
}

// ── Context Threads ──────────────────────────────────────────

export async function listContextThreads(sql, orgId, filters = {}) {
  const { agentId, status, limit = 20 } = filters;
  const conditions = ['org_id = $1'];
  const params = [orgId];
  let idx = 2;

  if (agentId) {
    conditions.push(`agent_id = $${idx}`);
    params.push(agentId);
    idx++;
  }
  if (status) {
    conditions.push(`status = $${idx}`);
    params.push(status);
    idx++;
  }

  const where = conditions.join(' AND ');
  return sql.query(
    `SELECT * FROM context_threads WHERE ${where} ORDER BY updated_at DESC LIMIT $${idx}`,
    [...params, limit]
  );
}

export async function upsertContextThread(sql, payload) {
  const { id, orgId, agent_id, name, summary, now } = payload;
  const rows = await sql`
    INSERT INTO context_threads (id, org_id, agent_id, name, summary, status, created_at, updated_at)
    VALUES (${id}, ${orgId}, ${agent_id || null}, ${name}, ${summary || null}, 'active', ${now}, ${now})
    ON CONFLICT (org_id, COALESCE(agent_id, ''), name)
    DO UPDATE SET summary = COALESCE(EXCLUDED.summary, context_threads.summary), status = 'active', updated_at = ${now}
    RETURNING *
  `;
  return rows[0] || null;
}
