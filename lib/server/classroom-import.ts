import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import JSZip from 'jszip';
import { CLASSROOMS_DIR, isValidClassroomId, persistClassroom } from '@/lib/server/classroom-storage';
import type { ClassroomManifest, ManifestAction } from '@/lib/export/classroom-zip-types';
import type { Action, SpeechAction } from '@/lib/types/action';
import type { Scene, Stage } from '@/lib/types/stage';

interface ImportClassroomZipPackageInput {
  bytes: Buffer;
  fileName: string;
  baseUrl: string;
  requestedId?: string;
}

interface RewriteOptions {
  baseUrl: string;
  classroomId: string;
  audioRefToUrl: Record<string, string>;
  mediaRefToUrl: Record<string, string>;
  agentIds: string[];
  fallbackDiscussionAgentIndex?: number;
}

function cleanImportedId(value: string | undefined) {
  const cleaned = value?.trim().replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  return cleaned && isValidClassroomId(cleaned) ? cleaned : undefined;
}

function getFileStem(fileName: string) {
  return path.basename(fileName)
    .replace(/\.maic\.zip$/i, '')
    .replace(/\.zip$/i, '');
}

function mediaServingUrl(baseUrl: string, classroomId: string, subPath: string) {
  return `${baseUrl.replace(/\/+$/, '')}/api/classroom-media/${classroomId}/${subPath}`;
}

function extForMimeType(mimeType?: string) {
  if (!mimeType) {
    return '';
  }

  const normalized = mimeType.toLowerCase();

  if (normalized.includes('mpeg')) return 'mp3';
  if (normalized.includes('jpeg')) return 'jpg';
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('gif')) return 'gif';
  if (normalized.includes('mp4')) return 'mp4';
  if (normalized.includes('webm')) return 'webm';
  if (normalized.includes('wav')) return 'wav';
  if (normalized.includes('ogg')) return 'ogg';
  if (normalized.includes('aac')) return 'aac';

  return '';
}

function safeMediaFileName(zipPath: string, mimeType?: string) {
  const rawName = path.posix.basename(zipPath);
  const parsed = path.posix.parse(rawName);
  const base = (parsed.name || 'asset').replace(/[^a-zA-Z0-9_.-]/g, '-');
  const extension = parsed.ext.replace(/^\./, '') || extForMimeType(mimeType) || 'bin';

  return `${base}.${extension}`;
}

async function writeZipFile(zip: JSZip, zipPath: string, targetDir: string, mimeType?: string) {
  const entry = zip.file(zipPath);

  if (!entry) {
    return undefined;
  }

  await fs.mkdir(targetDir, { recursive: true });
  const fileName = safeMediaFileName(zipPath, mimeType);
  const bytes = await entry.async('nodebuffer');
  await fs.writeFile(path.join(targetDir, fileName), bytes);

  return fileName;
}

function pickFallbackDiscussionAgentIndex(agents: ClassroomManifest['agents']) {
  const studentAgentIndex = agents.findIndex((agent) => agent.role === 'student');
  const nonTeacherAgentIndex = agents.findIndex((agent) => agent.role !== 'teacher');

  if (studentAgentIndex >= 0) return studentAgentIndex;
  if (nonTeacherAgentIndex >= 0) return nonTeacherAgentIndex;
  return undefined;
}

function rewriteManifestActions(actions: ManifestAction[] | undefined, options: RewriteOptions) {
  return actions?.map((action) => {
    if (action.type === 'speech') {
      const speech = action as ManifestAction & { type: 'speech'; audioRef?: string };
      const { audioRef, ...rest } = speech;
      const audioUrl = audioRef ? options.audioRefToUrl[audioRef] : undefined;

      return {
        ...rest,
        ...(audioUrl ? { audioUrl } : {}),
      } as SpeechAction;
    }

    if (action.type === 'discussion') {
      const discussion = action as ManifestAction & { type: 'discussion'; agentIndex?: number; agentId?: string };
      const { agentIndex, agentId: legacyAgentId, ...rest } = discussion;
      const indexedAgentId = typeof agentIndex === 'number' ? options.agentIds[agentIndex] : undefined;
      const preservedLegacyAgentId =
        legacyAgentId && (!options.agentIds.length || options.agentIds.includes(legacyAgentId))
          ? legacyAgentId
          : undefined;
      const fallbackAgentId = typeof options.fallbackDiscussionAgentIndex === 'number'
        ? options.agentIds[options.fallbackDiscussionAgentIndex]
        : undefined;

      return {
        ...rest,
        ...(indexedAgentId || preservedLegacyAgentId || fallbackAgentId
          ? { agentId: indexedAgentId || preservedLegacyAgentId || fallbackAgentId }
          : {}),
      } as Action;
    }

    return action as Action;
  });
}

function rewriteSceneMedia(scene: Scene, mediaRefToUrl: Record<string, string>) {
  if (scene.type !== 'slide') {
    return;
  }

  const canvas = (scene.content as {
    canvas?: {
      elements?: Array<{ src?: string; mediaRef?: string; type?: string }>;
      background?: { image?: { src?: string } };
    };
  }).canvas;

  if (!canvas) {
    return;
  }

  if (canvas.background?.image?.src && mediaRefToUrl[canvas.background.image.src]) {
    canvas.background.image.src = mediaRefToUrl[canvas.background.image.src];
  }

  for (const element of canvas.elements ?? []) {
    if (element.mediaRef && mediaRefToUrl[element.mediaRef]) {
      element.src = mediaRefToUrl[element.mediaRef];
    }

    if (element.src && mediaRefToUrl[element.src]) {
      element.src = mediaRefToUrl[element.src];
    }
  }
}

function validateManifest(value: unknown): ClassroomManifest {
  const manifest = value as ClassroomManifest;

  if (
    !manifest
    || typeof manifest !== 'object'
    || !manifest.stage
    || !Array.isArray(manifest.scenes)
  ) {
    throw new Error('Invalid OpenMAIC classroom package manifest.');
  }

  return manifest;
}

export async function importClassroomZipPackage(input: ImportClassroomZipPackageInput) {
  const zip = await JSZip.loadAsync(input.bytes);
  const manifestEntry = zip.file('manifest.json');

  if (!manifestEntry) {
    throw new Error('OpenMAIC classroom package is missing manifest.json.');
  }

  const manifest = validateManifest(JSON.parse(await manifestEntry.async('text')));
  const classroomId = cleanImportedId(input.requestedId)
    ?? cleanImportedId(`import-${getFileStem(input.fileName)}`)
    ?? `import-${randomUUID()}`;
  const classroomDir = path.join(CLASSROOMS_DIR, classroomId);
  const audioDir = path.join(classroomDir, 'audio');
  const mediaDir = path.join(classroomDir, 'media');
  const audioRefToUrl: Record<string, string> = {};
  const mediaRefToUrl: Record<string, string> = {};

  await fs.rm(classroomDir, { recursive: true, force: true });

  for (const [zipPath, entry] of Object.entries(manifest.mediaIndex ?? {})) {
    if (entry.missing) {
      continue;
    }

    if (entry.type === 'audio') {
      const fileName = await writeZipFile(zip, zipPath, audioDir, entry.mimeType);
      if (fileName) {
        audioRefToUrl[zipPath] = mediaServingUrl(input.baseUrl, classroomId, `audio/${fileName}`);
      }
      continue;
    }

    if (entry.type === 'image' || entry.type === 'generated') {
      const fileName = await writeZipFile(zip, zipPath, mediaDir, entry.mimeType);
      if (fileName) {
        const elementId = path.posix.parse(path.posix.basename(zipPath)).name;
        const url = mediaServingUrl(input.baseUrl, classroomId, `media/${fileName}`);
        mediaRefToUrl[zipPath] = url;
        mediaRefToUrl[elementId] = url;
      }
    }
  }

  const agentIds = (manifest.agents ?? []).map((_agent, index) => `${classroomId}-agent-${index + 1}`);
  const stage: Stage = {
    id: classroomId,
    name: manifest.stage.name || getFileStem(input.fileName) || 'Imported Classroom',
    description: manifest.stage.description,
    createdAt: manifest.stage.createdAt || Date.now(),
    updatedAt: Date.now(),
    languageDirective: manifest.stage.language,
    style: manifest.stage.style,
    agentIds: agentIds.length ? agentIds : undefined,
    generatedAgentConfigs: (manifest.agents ?? []).map((agent, index) => ({
      id: agentIds[index],
      name: agent.name,
      role: agent.role,
      persona: agent.persona,
      avatar: agent.avatar,
      color: agent.color,
      priority: agent.priority,
    })),
  };

  const fallbackDiscussionAgentIndex = pickFallbackDiscussionAgentIndex(manifest.agents ?? []);
  const scenes: Scene[] = manifest.scenes.map((scene, index) => {
    const nextScene: Scene = {
      id: `${classroomId}-scene-${index + 1}`,
      stageId: classroomId,
      type: scene.type,
      title: scene.title,
      order: scene.order ?? index,
      content: scene.content,
      actions: rewriteManifestActions(scene.actions, {
        baseUrl: input.baseUrl,
        classroomId,
        audioRefToUrl,
        mediaRefToUrl,
        agentIds,
        fallbackDiscussionAgentIndex,
      }),
      whiteboards: scene.whiteboards,
      multiAgent: scene.multiAgent?.enabled
        ? {
            enabled: true,
            agentIds: (scene.multiAgent.agentIndices ?? [])
              .map((agentIndex) => agentIds[agentIndex])
              .filter(Boolean),
            directorPrompt: scene.multiAgent.directorPrompt,
          }
        : undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    rewriteSceneMedia(nextScene, mediaRefToUrl);
    return nextScene;
  });

  const persisted = await persistClassroom({ id: classroomId, stage, scenes }, input.baseUrl);

  return {
    ...persisted,
    stage,
    scenes,
    sourceFileName: input.fileName,
  };
}
