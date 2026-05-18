import { beforeEach, describe, expect, it, vi } from 'vitest';

const markRunningMock = vi.fn();
const markSucceededMock = vi.fn();
const markFailedMock = vi.fn();
const updateProgressMock = vi.fn();
const generateClassroomMock = vi.fn();
const reportDiagnosticMock = vi.fn();

vi.mock('@/lib/server/classroom-job-store', () => ({
  markClassroomGenerationJobRunning: markRunningMock,
  markClassroomGenerationJobSucceeded: markSucceededMock,
  markClassroomGenerationJobFailed: markFailedMock,
  updateClassroomGenerationJobProgress: updateProgressMock,
}));

vi.mock('@/lib/server/classroom-generation', () => ({
  generateClassroom: generateClassroomMock,
}));

vi.mock('@/lib/server/familybuddy-diagnostics', () => ({
  reportOpenMaicRuntimeDiagnostic: reportDiagnosticMock,
}));

describe('classroom job runner diagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('DEFAULT_MODEL', 'openai:familybuddy-managed');
  });

  it('reports background classroom generation failures to FamilyBuddy diagnostics', async () => {
    generateClassroomMock.mockRejectedValueOnce(new Error('LLM returned empty response'));

    const { runClassroomGenerationJob } = await import('@/lib/server/classroom-job-runner');

    await runClassroomGenerationJob(
      'job-diagnostics',
      {
        requirement: '帮我学习抛物线',
        enableImageGeneration: true,
        enableVideoGeneration: false,
        enableTTS: true,
      },
      'http://127.0.0.1:3000',
    );

    expect(markRunningMock).toHaveBeenCalledWith('job-diagnostics');
    expect(markFailedMock).toHaveBeenCalledWith(
      'job-diagnostics',
      'LLM returned empty response',
    );
    expect(markSucceededMock).not.toHaveBeenCalled();
    expect(reportDiagnosticMock).toHaveBeenCalledTimes(1);
    expect(reportDiagnosticMock).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'generate_classroom_job',
        providerId: 'openai',
        modelString: 'openai:familybuddy-managed',
        errorCode: 'OPENMAIC_CLASSROOM_JOB_FAILED',
        errorMessage: 'LLM returned empty response',
        responseSize: 0,
        requestMessageCount: 1,
        hasMultimodalContent: false,
      }),
    );
  });
});
