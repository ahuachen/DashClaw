export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';

export async function POST(request) {
  const password = process.env.DASHCLAW_LOCAL_ADMIN_PASSWORD;
  if (!password) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const { password: submittedPassword } = await request.json();

    if (!submittedPassword) {
      return NextResponse.json({ error: 'Password is required.' }, { status: 401 });
    }

    const encoder = new TextEncoder();
    const submittedBuf = encoder.encode(submittedPassword);
    const actualBuf = encoder.encode(password);

    if (submittedBuf.length !== actualBuf.length) {
      await new Promise(r => setTimeout(r, 500));
      return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
    }

    const nodeCrypto = await import('node:crypto');
    if (!nodeCrypto.timingSafeEqual(submittedBuf, actualBuf)) {
      await new Promise(r => setTimeout(r, 500));
      return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
    }

    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
    const token = await new SignJWT({
      sub: 'local-admin',
      userId: 'usr_local_admin',
      orgId: 'org_default',
      role: 'admin',
      plan: 'free',
      provider: 'local'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret);

    const response = NextResponse.json({ ok: true });
    response.cookies.set('dashclaw-local-session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 604800,
      path: '/'
    });

    return response;
  } catch (error) {
    console.error('Local auth error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set('dashclaw-local-session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/'
  });
  return response;
}
