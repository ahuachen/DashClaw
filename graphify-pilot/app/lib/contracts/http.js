import { NextResponse } from 'next/server';

function formatZodIssues(issues) {
  return issues.map((issue) => ({
    path: issue.path.join('.'),
    code: issue.code,
    message: issue.message,
  }));
}

export async function parseJsonWithSchema(request, schema) {
  let body;
  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }),
    };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Validation failed',
          details: formatZodIssues(parsed.error.issues),
        },
        { status: 400 }
      ),
    };
  }

  return { ok: true, data: parsed.data };
}
