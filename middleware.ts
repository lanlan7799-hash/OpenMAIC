import { NextRequest, NextResponse } from 'next/server';
import {
  FAMILYBUDDY_LAUNCH_COOKIE,
  resolveFamilyBuddyLaunchSecret,
  verifyFamilyBuddyLaunchToken,
} from '@/lib/server/familybuddy-launch-token';

/** Convert string to Uint8Array */
function encode(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/** Convert ArrayBuffer to hex string */
function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Verify an HMAC-signed token using Web Crypto API (Edge-compatible) */
async function verifyToken(token: string, accessCode: string): Promise<boolean> {
  const dotIndex = token.indexOf('.');
  if (dotIndex === -1) return false;

  const timestamp = token.substring(0, dotIndex);
  const signature = token.substring(dotIndex + 1);

  const keyData = encode(accessCode);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const data = encode(timestamp);
  const expected = bufToHex(await crypto.subtle.sign('HMAC', key, data.buffer as ArrayBuffer));

  // Constant-length comparison (not truly constant-time in JS, but sufficient here)
  if (signature.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function middleware(request: NextRequest) {
  const accessCode = process.env.ACCESS_CODE;
  if (!accessCode) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Whitelist: access-code endpoints, health check
  if (pathname.startsWith('/api/access-code/') || pathname === '/api/health') {
    return NextResponse.next();
  }

  // Check cookie — validate HMAC signature, not just existence
  const cookie = request.cookies.get('openmaic_access');
  if (cookie?.value && (await verifyToken(cookie.value, accessCode))) {
    return NextResponse.next();
  }

  const launchSecret = resolveFamilyBuddyLaunchSecret(accessCode);
  const launchCookie = request.cookies.get(FAMILYBUDDY_LAUNCH_COOKIE);
  if (
    launchCookie?.value &&
    (await verifyFamilyBuddyLaunchToken(launchCookie.value, launchSecret)).ok
  ) {
    return NextResponse.next();
  }

  const launchToken = request.nextUrl.searchParams.get('fbToken') || undefined;
  if (request.nextUrl.searchParams.get('familyBuddy') === '1' && launchToken) {
    const verification = await verifyFamilyBuddyLaunchToken(launchToken, launchSecret);
    if (verification.ok) {
      const cleanUrl = request.nextUrl.clone();
      cleanUrl.searchParams.delete('fbToken');
      const response = NextResponse.redirect(cleanUrl);
      const nowSeconds = Math.floor(Date.now() / 1000);
      response.cookies.set(FAMILYBUDDY_LAUNCH_COOKIE, launchToken, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: Math.max(0, verification.payload.exp - nowSeconds),
        secure: process.env.NODE_ENV === 'production',
      });
      return response;
    }
  }

  // API requests without valid cookie → 401
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { success: false, errorCode: 'INVALID_REQUEST', error: 'Access code required' },
      { status: 401 },
    );
  }

  // Page requests → let through, frontend shows modal
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logos/).*)'],
};
