import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('familybuddy diagnostics reporter', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.OPENAI_MODELS;
    delete process.env.FAMILYBUDDY_RELAY_BASE_URL;
    delete process.env.FAMILYBUDDY_RELAY_TOKEN;
    delete process.env.OPENMAIC_AI_RELAY_BASE_URL;
    delete process.env.OPENMAIC_AI_RELAY_TOKEN;
    vi.restoreAllMocks();
  });

  it('posts OpenMAIC terminal generation failures to the FamilyBuddy diagnostics relay', async () => {
    vi.stubEnv('OPENAI_BASE_URL', 'http://127.0.0.1:4000/api/openmaic/ai/v1');
    vi.stubEnv('OPENAI_API_KEY', 'relay-secret-for-tests');
    vi.stubEnv('OPENAI_MODELS', 'familybuddy-managed');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal('fetch', fetchMock);

    const { reportOpenMaicRuntimeDiagnostic } = await import(
      '@/lib/server/familybuddy-diagnostics'
    );

    await reportOpenMaicRuntimeDiagnostic({
      operation: 'scene_outlines_stream',
      providerId: 'openai',
      modelString: 'openai:familybuddy-managed',
      errorMessage: 'LLM returned empty response',
      upstreamErrorBody: 'attempts=3; textLen=0; outlines=0',
      durationMs: 15432,
      requestSize: 3051,
      responseSize: 0,
      requestMessageCount: 1,
      hasMultimodalContent: false,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:4000/api/openmaic/ai/v1/diagnostics',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer relay-secret-for-tests',
          'Content-Type': 'application/json',
        },
      }),
    );

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      operation: 'scene_outlines_stream',
      provider: 'openai',
      model: 'openai:familybuddy-managed',
      status: 'error',
      durationMs: 15432,
      errorCode: 'OPENMAIC_GENERATION_FAILED',
      errorMessage: 'LLM returned empty response',
      upstreamErrorBody: 'attempts=3; textLen=0; outlines=0',
      requestSize: 3051,
      responseSize: 0,
      requestMessageCount: 1,
      hasMultimodalContent: false,
    });
  });

  it('does not report diagnostics for non-FamilyBuddy OpenAI base URLs', async () => {
    vi.stubEnv('OPENAI_BASE_URL', 'https://api.openai.com/v1');
    vi.stubEnv('OPENAI_API_KEY', 'sk-openai');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { reportOpenMaicRuntimeDiagnostic } = await import(
      '@/lib/server/familybuddy-diagnostics'
    );

    await reportOpenMaicRuntimeDiagnostic({
      operation: 'scene_outlines_stream',
      providerId: 'openai',
      modelString: 'openai:gpt-4o-mini',
      errorMessage: 'LLM returned empty response',
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
