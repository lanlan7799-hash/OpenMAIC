import { describe, expect, it } from 'vitest';
import { resolveAgentVoice, type ProviderWithVoices } from '@/lib/audio/voice-resolver';
import type { AgentConfig } from '@/lib/orchestration/registry/types';

const student: AgentConfig = {
  id: 'student-1',
  name: 'Student',
  role: 'student',
  persona: 'Curious learner',
  avatar: 'S',
  color: '#2563eb',
  allowedActions: [],
  priority: 1,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  isDefault: false,
};

function provider(providerId: ProviderWithVoices['providerId']): ProviderWithVoices {
  return {
    providerId,
    providerName: providerId,
    voices: [{ id: providerId === 'familybuddy-tts' ? 'default' : 'Cherry', name: 'Voice' }],
    modelGroups: [],
  };
}

describe('resolveAgentVoice', () => {
  it('prefers FamilyBuddy managed TTS for fallback voices', () => {
    const voice = resolveAgentVoice(student, 0, [
      provider('qwen-tts'),
      provider('familybuddy-tts'),
    ]);

    expect(voice).toEqual({
      providerId: 'familybuddy-tts',
      voiceId: 'default',
    });
  });
});
