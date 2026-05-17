import { resolveApiKey, resolveBaseUrl } from '@/lib/server/provider-config';
import { createLogger } from '@/lib/logger';

const log = createLogger('FamilyBuddy Diagnostics');

interface OpenMaicRuntimeDiagnosticInput {
  operation: string;
  providerId: string;
  modelString: string;
  errorMessage: string;
  errorCode?: string;
  upstreamErrorBody?: string;
  durationMs?: number;
  requestSize?: number;
  responseSize?: number;
  requestMessageCount?: number;
  hasMultimodalContent?: boolean;
}

function getFamilyBuddyDiagnosticsUrl(providerId: string) {
  const baseUrl = resolveBaseUrl(providerId);

  if (!baseUrl || !baseUrl.includes('/api/openmaic/ai/v1')) {
    return null;
  }

  return `${baseUrl.replace(/\/$/, '')}/diagnostics`;
}

function normalizeProvider(providerId: string) {
  switch (providerId) {
    case 'gemini':
    case 'deepseek':
    case 'minimax':
    case 'doubao':
    case 'openai':
      return providerId;
    case 'qwen':
      return 'qwen_bailian';
    default:
      return 'openai';
  }
}

function normalizeNonNegativeInteger(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : 0;
}

export async function reportOpenMaicRuntimeDiagnostic(input: OpenMaicRuntimeDiagnosticInput) {
  const url = getFamilyBuddyDiagnosticsUrl(input.providerId);
  const token = resolveApiKey(input.providerId);

  if (!url || !token) {
    return;
  }

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operation: input.operation,
        provider: normalizeProvider(input.providerId),
        providerConfigId: 'openmaic-runtime',
        providerDisplayName: 'OpenMAIC Runtime',
        model: input.modelString,
        endpointHost: new URL(url).host,
        status: 'error',
        durationMs: normalizeNonNegativeInteger(input.durationMs),
        httpStatus: null,
        errorCode: input.errorCode || 'OPENMAIC_GENERATION_FAILED',
        errorMessage: input.errorMessage,
        upstreamErrorBody: input.upstreamErrorBody,
        requestSize: normalizeNonNegativeInteger(input.requestSize),
        responseSize: normalizeNonNegativeInteger(input.responseSize),
        requestMessageCount: normalizeNonNegativeInteger(input.requestMessageCount),
        hasMultimodalContent: input.hasMultimodalContent === true,
      }),
    });
  } catch (error) {
    log.warn('Failed to report OpenMAIC diagnostic to FamilyBuddy relay:', error);
  }
}
