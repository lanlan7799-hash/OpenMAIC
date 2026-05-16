/**
 * Image Generation Service -- routes to provider adapters
 */

import type {
  ImageProviderId,
  ImageGenerationConfig,
  ImageGenerationOptions,
  ImageGenerationResult,
  ImageProviderConfig,
} from './types';
import { generateWithSeedream, testSeedreamConnectivity } from './adapters/seedream-adapter';
import {
  generateWithOpenAIImage,
  testOpenAIImageConnectivity,
} from './adapters/openai-image-adapter';
import { generateWithQwenImage, testQwenImageConnectivity } from './adapters/qwen-image-adapter';
import { generateWithNanoBanana, testNanoBananaConnectivity } from './adapters/nano-banana-adapter';
import {
  generateWithMiniMaxImage,
  testMiniMaxImageConnectivity,
} from './adapters/minimax-image-adapter';
import { generateWithGrokImage, testGrokImageConnectivity } from './adapters/grok-image-adapter';
import {
  generateWithLemonadeImage,
  testLemonadeImageConnectivity,
} from './adapters/lemonade-image-adapter';

export const IMAGE_PROVIDERS: Record<ImageProviderId, ImageProviderConfig> = {
  seedream: {
    id: 'seedream',
    name: 'Seedream',
    requiresApiKey: true,
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com',
    models: [
      { id: 'doubao-seedream-5-0-260128', name: 'Seedream 5.0 Lite' },
      { id: 'doubao-seedream-4-5-251128', name: 'Seedream 4.5' },
      { id: 'doubao-seedream-4-0-250828', name: 'Seedream 4.0' },
      { id: 'doubao-seedream-3-0-t2i-250415', name: 'Seedream 3.0' },
    ],
    supportedAspectRatios: ['16:9', '4:3', '1:1', '9:16'],
  },
  'openai-image': {
    id: 'openai-image',
    name: 'OpenAI Image',
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-image-2', name: 'GPT Image 2' },
      { id: 'gpt-image-2-2026-04-21', name: 'GPT Image 2 (2026-04-21)' },
      { id: 'gpt-image-1.5', name: 'GPT Image 1.5' },
      { id: 'gpt-image-1', name: 'GPT Image 1' },
      { id: 'gpt-image-1-mini', name: 'GPT Image 1 Mini' },
      { id: 'chatgpt-image-latest', name: 'ChatGPT Image Latest' },
    ],
    supportedAspectRatios: ['16:9', '4:3', '1:1', '9:16'],
  },
  'qwen-image': {
    id: 'qwen-image',
    name: 'Qwen Image',
    requiresApiKey: true,
    defaultBaseUrl: 'https://dashscope.aliyuncs.com',
    models: [
      { id: 'qwen-image-2.0-pro', name: 'Qwen Image 2.0 Pro' },
      { id: 'qwen-image-2.0-pro-2026-03-03', name: 'Qwen Image 2.0 Pro (2026-03-03)' },
      { id: 'qwen-image-2.0', name: 'Qwen Image 2.0' },
      { id: 'qwen-image-2.0-2026-03-03', name: 'Qwen Image 2.0 (2026-03-03)' },
      { id: 'qwen-image-max', name: 'Qwen Image Max' },
      { id: 'qwen-image-max-2025-12-30', name: 'Qwen Image Max (2025-12-30)' },
      { id: 'qwen-image-plus', name: 'Qwen Image Plus' },
      {
        id: 'qwen-image-plus-2026-01-09',
        name: 'Qwen Image Plus (2026-01-09)',
      },
      { id: 'qwen-image', name: 'Qwen Image' },
      { id: 'z-image-turbo', name: 'Z-Image Turbo' },
    ],
    supportedAspectRatios: ['16:9', '4:3', '1:1', '9:16'],
  },
  'nano-banana': {
    id: 'nano-banana',
    name: 'Nano Banana (Gemini)',
    requiresApiKey: true,
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    models: [
      {
        id: 'gemini-3.1-flash-image-preview',
        name: 'Gemini 3.1 Flash Image (Nano Banana 2)',
      },
      {
        id: 'gemini-3-pro-image-preview',
        name: 'Gemini 3 Pro Image (Nano Banana Pro)',
      },
      {
        id: 'gemini-2.5-flash-image',
        name: 'Gemini 2.5 Flash Image (Nano Banana)',
      },
    ],
    supportedAspectRatios: ['16:9', '4:3', '1:1'],
  },
  'minimax-image': {
    id: 'minimax-image',
    name: 'MiniMax Image',
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.minimaxi.com',
    models: [
      { id: 'image-01', name: 'Image 01' },
      { id: 'image-01-live', name: 'Image 01 Live' },
    ],
    supportedAspectRatios: ['16:9', '4:3', '1:1', '9:16'],
  },
  'grok-image': {
    id: 'grok-image',
    name: 'Grok Image (xAI)',
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.x.ai/v1',
    models: [
      { id: 'grok-imagine-image', name: 'Grok Imagine Image' },
      { id: 'grok-imagine-image-pro', name: 'Grok Imagine Image Pro' },
    ],
    supportedAspectRatios: ['16:9', '4:3', '1:1', '9:16'],
  },
  lemonade: {
    id: 'lemonade',
    name: 'Lemonade',
    requiresApiKey: false,
    defaultBaseUrl: 'http://localhost:13305/v1',
    icon: '/logos/lemonade.svg',
    models: [
      { id: 'Qwen-Image-GGUF', name: 'Qwen Image GGUF' },
      { id: 'sd-cpp', name: 'Stable Diffusion (sd-cpp)' },
    ],
    supportedAspectRatios: ['16:9', '4:3', '1:1', '9:16'],
    maxResolution: { width: 1024, height: 1024 },
  },
  'familybuddy-image': {
    id: 'familybuddy-image',
    name: 'FamilyBuddy Managed Image',
    requiresApiKey: true,
    models: [{ id: 'familybuddy-managed-image', name: 'FamilyBuddy Managed Image' }],
    supportedAspectRatios: ['16:9', '4:3', '1:1', '9:16'],
    maxResolution: { width: 1024, height: 1024 },
  },
};

export async function testImageConnectivity(
  config: ImageGenerationConfig,
): Promise<{ success: boolean; message: string }> {
  switch (config.providerId) {
    case 'seedream':
      return testSeedreamConnectivity(config);
    case 'openai-image':
      return testOpenAIImageConnectivity(config);
    case 'qwen-image':
      return testQwenImageConnectivity(config);
    case 'nano-banana':
      return testNanoBananaConnectivity(config);
    case 'minimax-image':
      return testMiniMaxImageConnectivity(config);
    case 'grok-image':
      return testGrokImageConnectivity(config);
    case 'lemonade':
      return testLemonadeImageConnectivity(config);
    case 'familybuddy-image':
      return {
        success: Boolean(config.apiKey && config.baseUrl),
        message: config.apiKey && config.baseUrl
          ? 'Connected to FamilyBuddy image relay'
          : 'FamilyBuddy image relay is not configured',
      };
    default:
      return {
        success: false,
        message: `Unsupported image provider: ${config.providerId}`,
      };
  }
}

export async function generateImage(
  config: ImageGenerationConfig,
  options: ImageGenerationOptions,
): Promise<ImageGenerationResult> {
  switch (config.providerId) {
    case 'seedream':
      return generateWithSeedream(config, options);
    case 'openai-image':
      return generateWithOpenAIImage(config, options);
    case 'qwen-image':
      return generateWithQwenImage(config, options);
    case 'nano-banana':
      return generateWithNanoBanana(config, options);
    case 'minimax-image':
      return generateWithMiniMaxImage(config, options);
    case 'grok-image':
      return generateWithGrokImage(config, options);
    case 'lemonade':
      return generateWithLemonadeImage(config, options);
    case 'familybuddy-image':
      return generateWithFamilyBuddyImage(config, options);
    default:
      throw new Error(`Unsupported image provider: ${config.providerId}`);
  }
}

async function generateWithFamilyBuddyImage(
  config: ImageGenerationConfig,
  options: ImageGenerationOptions,
): Promise<ImageGenerationResult> {
  const baseUrl = config.baseUrl?.replace(/\/$/, '');
  if (!baseUrl) {
    throw new Error('FamilyBuddy image relay base URL is required');
  }

  const width = options.width || 1024;
  const height = options.height || 1024;
  const response = await fetch(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || 'familybuddy-managed-image',
      prompt: options.prompt,
      n: 1,
      size: `${width}x${height}`,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`FamilyBuddy image generation failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  const imageData = data.data?.[0] ?? data.result;
  if (!imageData?.url && !imageData?.b64_json && !imageData?.base64) {
    throw new Error('FamilyBuddy image relay returned empty image response');
  }

  return {
    url: imageData.url,
    base64: imageData.b64_json || imageData.base64,
    width,
    height,
  };
}

export function aspectRatioToDimensions(
  ratio: string,
  maxWidth = 1024,
): { width: number; height: number } {
  const [w, h] = ratio.split(':').map(Number);
  if (!w || !h) return { width: maxWidth, height: Math.round((maxWidth * 9) / 16) };
  return { width: maxWidth, height: Math.round((maxWidth * h) / w) };
}
