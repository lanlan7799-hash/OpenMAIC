import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import { afterEach, beforeAll, describe, expect, test } from 'vitest';

const TEST_CLASSROOMS_DIR = await mkdtemp(path.join(os.tmpdir(), 'openmaic-classroom-import-'));
process.env.OPENMAIC_CLASSROOMS_DIR = TEST_CLASSROOMS_DIR;

const { importClassroomZipPackage } = await import('@/lib/server/classroom-import');

afterEach(async () => {
  await rm(TEST_CLASSROOMS_DIR, { recursive: true, force: true });
});

beforeAll(async () => {
  await rm(TEST_CLASSROOMS_DIR, { recursive: true, force: true });
});

describe('importClassroomZipPackage', () => {
  test('imports a classroom zip package into server classroom storage', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify({
      formatVersion: 1,
      exportedAt: '2026-05-27T00:00:00.000Z',
      appVersion: '0.2.1',
      stage: {
        name: '自然拼读课堂',
        description: '短元音 a',
        language: 'zh-CN',
        style: 'child-friendly',
        createdAt: 1,
        updatedAt: 2,
      },
      agents: [{
        name: '老师',
        role: 'teacher',
        persona: '耐心讲解。',
        avatar: 'T',
        color: '#2563eb',
        priority: 1,
      }],
      scenes: [{
        type: 'slide',
        title: '第一课',
        order: 0,
        content: { type: 'slide', canvas: { id: 'slide-1', elements: [] } },
        actions: [{ id: 'speech-1', type: 'speech', text: '开始学习', audioRef: 'audio/speech-1.mp3' }],
      }],
      mediaIndex: {
        'audio/speech-1.mp3': { type: 'audio', format: 'mp3', size: 5 },
      },
    }));
    zip.file('audio/speech-1.mp3', Buffer.from('audio'));

    const result = await importClassroomZipPackage({
      bytes: Buffer.from(await zip.generateAsync({ type: 'nodebuffer' })),
      fileName: 'phonics.maic.zip',
      baseUrl: 'https://openmaic.example.test',
      requestedId: 'import-test-course',
    });

    expect(result.id).toBe('import-test-course');
    expect(result.url).toBe('https://openmaic.example.test/classroom/import-test-course');
    expect(result.stage.name).toBe('自然拼读课堂');
    expect(result.scenes).toHaveLength(1);
    expect(result.scenes[0].stageId).toBe('import-test-course');
    expect(result.scenes[0].actions?.[0]).toMatchObject({
      type: 'speech',
      audioUrl: 'https://openmaic.example.test/api/classroom-media/import-test-course/audio/speech-1.mp3',
    });

    const classroomJson = JSON.parse(
      await readFile(path.join(TEST_CLASSROOMS_DIR, 'import-test-course.json'), 'utf8'),
    );
    expect(classroomJson.stage.id).toBe('import-test-course');
    expect(classroomJson.scenes[0].stageId).toBe('import-test-course');
    await expect(stat(path.join(TEST_CLASSROOMS_DIR, 'import-test-course', 'audio', 'speech-1.mp3'))).resolves.toBeTruthy();
  });
});
