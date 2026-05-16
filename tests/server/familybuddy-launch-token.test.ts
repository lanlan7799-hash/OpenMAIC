import { createHmac } from 'crypto';
import { describe, expect, it } from 'vitest';
import {
  FAMILYBUDDY_LAUNCH_COOKIE,
  verifyFamilyBuddyLaunchToken,
} from '@/lib/server/familybuddy-launch-token';

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function signPayload(payload: Record<string, unknown>, secret: string): string {
  const payloadSegment = base64url(JSON.stringify(payload));
  const signature = createHmac('sha256', secret).update(payloadSegment).digest('base64url');
  return `${payloadSegment}.${signature}`;
}

describe('FamilyBuddy launch token', () => {
  it('accepts a current FamilyBuddy OpenMAIC launch token', async () => {
    const token = signPayload(
      {
        iss: 'familybuddy',
        aud: 'openmaic',
        sub: 'child-001',
        childId: 'child-001',
        mode: 'familybuddy_embedded',
        aiRelayUrl: 'http://127.0.0.1:4000/api/openmaic/ai/v1/chat/completions',
        returnUrl: 'http://127.0.0.1:3005/learning/self-study',
        iat: 1_800_000_000,
        exp: 1_800_003_600,
      },
      'launch-secret',
    );

    await expect(
      verifyFamilyBuddyLaunchToken(token, 'launch-secret', {
        now: new Date('2027-01-15T08:00:00.000Z'),
      }),
    ).resolves.toMatchObject({
      ok: true,
      payload: {
        iss: 'familybuddy',
        aud: 'openmaic',
        childId: 'child-001',
        mode: 'familybuddy_embedded',
      },
    });
  });

  it('rejects expired tokens and tampered signatures', async () => {
    const payload = {
      iss: 'familybuddy',
      aud: 'openmaic',
      childId: 'child-001',
      mode: 'familybuddy_embedded',
      iat: 1_700_000_000,
      exp: 1_700_000_100,
    };
    const token = signPayload(payload, 'launch-secret');

    await expect(
      verifyFamilyBuddyLaunchToken(token, 'launch-secret', {
        now: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).resolves.toMatchObject({ ok: false, reason: 'expired' });

    await expect(
      verifyFamilyBuddyLaunchToken(`${token.slice(0, -1)}x`, 'launch-secret', {
        now: new Date('2023-11-14T22:13:25.000Z'),
      }),
    ).resolves.toMatchObject({ ok: false, reason: 'signature' });
  });

  it('uses a dedicated http-only cookie name for embedded sessions', () => {
    expect(FAMILYBUDDY_LAUNCH_COOKIE).toBe('openmaic_familybuddy_launch');
  });
});
