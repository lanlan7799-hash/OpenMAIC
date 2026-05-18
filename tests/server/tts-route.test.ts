import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  generateTTS: vi.fn(),
}));

vi.mock('@/lib/audio/tts-providers', () => ({
  generateTTS: mocks.generateTTS,
}));

vi.mock('@/lib/server/ssrf-guard', () => ({
  validateUrlForSSRF: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

async function postTTS(body: Record<string, unknown>) {
  const { POST } = await import('@/app/api/generate/tts/route');
  const request = new Request('http://localhost/api/generate/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST(request as unknown as NextRequest);
}

describe('POST /api/generate/tts', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    mocks.generateTTS.mockReset();
    mocks.generateTTS.mockResolvedValue({
      audio: new Uint8Array([1, 2, 3]),
      format: 'mp3',
    });
  });

  it('uses server FamilyBuddy relay credentials when client sends the server-configured relay base URL', async () => {
    vi.stubEnv('FAMILYBUDDY_RELAY_BASE_URL', 'https://familybuddy.cn/api/openmaic/ai/v1');
    vi.stubEnv('FAMILYBUDDY_RELAY_TOKEN', 'familybuddy-relay-token');

    const res = await postTTS({
      text: '请朗读这句话',
      audioId: 'discussion-part-1',
      ttsProviderId: 'familybuddy-tts',
      ttsModelId: 'familybuddy-managed-tts',
      ttsVoice: 'default',
      ttsBaseUrl: 'https://familybuddy.cn/api/openmaic/ai/v1',
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mocks.generateTTS).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: 'familybuddy-tts',
        apiKey: 'familybuddy-relay-token',
        baseUrl: 'https://familybuddy.cn/api/openmaic/ai/v1',
      }),
      '请朗读这句话',
    );
  });
});
