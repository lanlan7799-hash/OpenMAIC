import { createHmac } from 'crypto';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FAMILYBUDDY_LAUNCH_COOKIE } from '@/lib/server/familybuddy-launch-token';

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function signPayload(payload: Record<string, unknown>, secret: string): string {
  const payloadSegment = base64url(JSON.stringify(payload));
  const signature = createHmac('sha256', secret).update(payloadSegment).digest('base64url');
  return `${payloadSegment}.${signature}`;
}

async function loadMiddleware() {
  vi.resetModules();
  return import('@/middleware');
}

describe('FamilyBuddy embedded middleware auth', () => {
  afterEach(() => {
    delete process.env.ACCESS_CODE;
    delete process.env.OPENMAIC_LAUNCH_SECRET;
    delete process.env.FAMILYBUDDY_LAUNCH_SECRET;
    vi.unstubAllEnvs();
  });

  it('sets an embedded session cookie and removes the launch token from the URL', async () => {
    process.env.ACCESS_CODE = 'openmaic-access-code';
    process.env.OPENMAIC_LAUNCH_SECRET = 'launch-secret';

    const token = signPayload(
      {
        iss: 'familybuddy',
        aud: 'openmaic',
        childId: 'child-001',
        mode: 'familybuddy_embedded',
        iat: 1_800_000_000,
        exp: 1_800_003_600,
      },
      'launch-secret',
    );

    const { middleware } = await loadMiddleware();
    const request = new NextRequest(
      `http://127.0.0.1:3010/?familyBuddy=1&embedded=1&fbToken=${encodeURIComponent(token)}`,
    );
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('set-cookie')).toContain(FAMILYBUDDY_LAUNCH_COOKIE);
    expect(response.headers.get('location')).not.toContain('fbToken=');
    expect(response.headers.get('location')).toContain('familyBuddy=1');
  });

  it('sets a third-party compatible embedded session cookie in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.ACCESS_CODE = 'openmaic-access-code';
    process.env.OPENMAIC_LAUNCH_SECRET = 'launch-secret';

    const token = signPayload(
      {
        iss: 'familybuddy',
        aud: 'openmaic',
        childId: 'child-001',
        mode: 'familybuddy_embedded',
        iat: 1_800_000_000,
        exp: 1_800_003_600,
      },
      'launch-secret',
    );

    const { middleware } = await loadMiddleware();
    const request = new NextRequest(
      `https://openmaic.familybuddy.cn/?familyBuddy=1&embedded=1&fbToken=${encodeURIComponent(token)}`,
    );
    const response = await middleware(request);
    const setCookie = response.headers.get('set-cookie') ?? '';

    expect(setCookie).toContain(FAMILYBUDDY_LAUNCH_COOKIE);
    expect(setCookie).toContain('SameSite=none');
    expect(setCookie).toContain('Secure');
  });

  it('allows API requests carrying the embedded session cookie', async () => {
    process.env.ACCESS_CODE = 'openmaic-access-code';
    process.env.OPENMAIC_LAUNCH_SECRET = 'launch-secret';

    const token = signPayload(
      {
        iss: 'familybuddy',
        aud: 'openmaic',
        childId: 'child-001',
        mode: 'familybuddy_embedded',
        iat: 1_800_000_000,
        exp: 1_800_003_600,
      },
      'launch-secret',
    );

    const { middleware } = await loadMiddleware();
    const request = new NextRequest('http://127.0.0.1:3010/api/server-providers', {
      headers: {
        cookie: `${FAMILYBUDDY_LAUNCH_COOKIE}=${token}`,
      },
    });
    const response = await middleware(request);

    expect(response.status).not.toBe(401);
  });
});
