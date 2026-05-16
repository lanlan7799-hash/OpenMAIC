export const FAMILYBUDDY_LAUNCH_COOKIE = 'openmaic_familybuddy_launch';

export interface FamilyBuddyLaunchPayload {
  iss: 'familybuddy';
  aud: 'openmaic';
  childId: string;
  mode: 'familybuddy_embedded';
  sub?: string;
  aiRelayUrl?: string;
  returnUrl?: string;
  iat?: number;
  exp: number;
}

export type FamilyBuddyLaunchVerification =
  | { ok: true; payload: FamilyBuddyLaunchPayload }
  | {
      ok: false;
      reason: 'missing-secret' | 'format' | 'signature' | 'payload' | 'expired';
    };

function base64urlToBytes(value: string): Uint8Array | null {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function bytesToBase64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function isPayload(value: unknown): value is FamilyBuddyLaunchPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;
  return (
    payload.iss === 'familybuddy' &&
    payload.aud === 'openmaic' &&
    payload.mode === 'familybuddy_embedded' &&
    typeof payload.childId === 'string' &&
    payload.childId.length > 0 &&
    typeof payload.exp === 'number'
  );
}

export function resolveFamilyBuddyLaunchSecret(accessCode?: string): string {
  return (
    process.env.OPENMAIC_LAUNCH_SECRET ||
    process.env.FAMILYBUDDY_LAUNCH_SECRET ||
    accessCode ||
    ''
  );
}

export async function verifyFamilyBuddyLaunchToken(
  token: string | undefined,
  secret: string | undefined,
  options: { now?: Date } = {},
): Promise<FamilyBuddyLaunchVerification> {
  if (!secret) return { ok: false, reason: 'missing-secret' };
  if (!token) return { ok: false, reason: 'format' };

  const [payloadSegment, signature, extra] = token.split('.');
  if (!payloadSegment || !signature || extra !== undefined) {
    return { ok: false, reason: 'format' };
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expectedBytes = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadSegment)),
  );
  const expectedSignature = bytesToBase64url(expectedBytes);
  if (!timingSafeEqualString(signature, expectedSignature)) {
    return { ok: false, reason: 'signature' };
  }

  const payloadBytes = base64urlToBytes(payloadSegment);
  if (!payloadBytes) return { ok: false, reason: 'payload' };

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch {
    return { ok: false, reason: 'payload' };
  }

  if (!isPayload(payload)) return { ok: false, reason: 'payload' };

  const nowSeconds = Math.floor((options.now ?? new Date()).getTime() / 1000);
  if (payload.exp <= nowSeconds) return { ok: false, reason: 'expired' };

  return { ok: true, payload };
}
