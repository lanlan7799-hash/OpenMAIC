import { type NextRequest } from 'next/server';
import { apiError, apiSuccess, API_ERROR_CODES } from '@/lib/server/api-response';
import { buildRequestOrigin } from '@/lib/server/classroom-storage';
import { importClassroomZipPackage } from '@/lib/server/classroom-import';
import { createLogger } from '@/lib/logger';

const log = createLogger('ClassroomImport API');
const MAX_CLASSROOM_PACKAGE_BYTES = 200 * 1024 * 1024;

function getOptionalText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export async function POST(request: NextRequest) {
  let fileName = 'unknown';

  try {
    const formData = await request.formData();
    const file = formData.get('classroomPackage');

    if (!(file instanceof File)) {
      return apiError(
        API_ERROR_CODES.MISSING_REQUIRED_FIELD,
        400,
        'Missing required file field: classroomPackage',
      );
    }

    fileName = file.name || 'classroom.maic.zip';

    if (!/\.maic\.zip$/i.test(fileName) && !/\.zip$/i.test(fileName)) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'Only .maic.zip classroom packages are supported.');
    }

    if (file.size <= 0) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'Classroom package is empty.');
    }

    if (file.size > MAX_CLASSROOM_PACKAGE_BYTES) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 413, 'Classroom package is too large.');
    }

    const requestedId = getOptionalText(formData, 'classroomId')
      ?? getOptionalText(formData, 'contentId');
    const imported = await importClassroomZipPackage({
      bytes: Buffer.from(await file.arrayBuffer()),
      fileName,
      baseUrl: buildRequestOrigin(request),
      requestedId,
    });

    return apiSuccess({
      id: imported.id,
      url: imported.url,
      stageName: imported.stage.name,
      sceneCount: imported.scenes.length,
    }, 201);
  } catch (error) {
    log.error(`Classroom package import failed [file=${fileName}]:`, error);
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      'Failed to import classroom package',
      error instanceof Error ? error.message : String(error),
    );
  }
}
