import { createLogger } from '@/lib/logger';
import { generateClassroom, type GenerateClassroomInput } from '@/lib/server/classroom-generation';
import {
  markClassroomGenerationJobFailed,
  markClassroomGenerationJobRunning,
  markClassroomGenerationJobSucceeded,
  updateClassroomGenerationJobProgress,
} from '@/lib/server/classroom-job-store';
import { parseModelString } from '@/lib/ai/providers';
import { reportOpenMaicRuntimeDiagnostic } from '@/lib/server/familybuddy-diagnostics';

const log = createLogger('ClassroomJob');
const runningJobs = new Map<string, Promise<void>>();

function resolveJobDiagnosticModel() {
  const modelString = process.env.DEFAULT_MODEL || 'openai:familybuddy-managed';
  const { providerId } = parseModelString(modelString);
  return { modelString, providerId };
}

export function runClassroomGenerationJob(
  jobId: string,
  input: GenerateClassroomInput,
  baseUrl: string,
): Promise<void> {
  const existing = runningJobs.get(jobId);
  if (existing) {
    return existing;
  }

  const jobPromise = (async () => {
    try {
      await markClassroomGenerationJobRunning(jobId);

      const result = await generateClassroom(input, {
        baseUrl,
        onProgress: async (progress) => {
          await updateClassroomGenerationJobProgress(jobId, progress);
        },
      });

      await markClassroomGenerationJobSucceeded(jobId, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Classroom generation job ${jobId} failed:`, error);
      const { modelString, providerId } = resolveJobDiagnosticModel();
      void reportOpenMaicRuntimeDiagnostic({
        operation: 'generate_classroom_job',
        providerId,
        modelString,
        errorCode: 'OPENMAIC_CLASSROOM_JOB_FAILED',
        errorMessage: message,
        upstreamErrorBody: `jobId=${jobId}; requirementLength=${input.requirement.length}; webSearch=${input.enableWebSearch === true ? 'yes' : 'no'}; image=${input.enableImageGeneration === true ? 'yes' : 'no'}; video=${input.enableVideoGeneration === true ? 'yes' : 'no'}; tts=${input.enableTTS === true ? 'yes' : 'no'}`,
        requestSize: JSON.stringify({
          requirement: input.requirement,
          pdfTextLength: input.pdfContent?.text?.length ?? 0,
          pdfImageCount: input.pdfContent?.images?.length ?? 0,
          enableWebSearch: input.enableWebSearch,
          enableImageGeneration: input.enableImageGeneration,
          enableVideoGeneration: input.enableVideoGeneration,
          enableTTS: input.enableTTS,
          agentMode: input.agentMode,
        }).length,
        responseSize: 0,
        requestMessageCount: 1,
        hasMultimodalContent: (input.pdfContent?.images?.length ?? 0) > 0,
      });
      try {
        await markClassroomGenerationJobFailed(jobId, message);
      } catch (markFailedError) {
        log.error(`Failed to persist failed status for job ${jobId}:`, markFailedError);
      }
    } finally {
      runningJobs.delete(jobId);
    }
  })();

  runningJobs.set(jobId, jobPromise);
  return jobPromise;
}
