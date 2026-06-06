import { describe, expect, it } from 'vitest';

import {
  deferOutlineToQueueEnd,
  getRetryableOutline,
  isRetryableOutline,
  upsertSceneByOrder,
} from '@/lib/generation/scene-generation-queue';

describe('scene generation queue helpers', () => {
  it('moves a failed outline behind the remaining pending outlines', () => {
    const page4 = { id: 'outline-4', order: 4, title: '数方格小游戏' };
    const page5 = { id: 'outline-5', order: 5, title: '长方形面积公式' };
    const page6 = { id: 'outline-6', order: 6, title: '正方形面积公式' };

    const nextQueue = deferOutlineToQueueEnd([page4, page5, page6], page4);

    expect(nextQueue.map((outline) => outline.id)).toEqual(['outline-5', 'outline-6', 'outline-4']);
  });

  it('keeps scenes ordered when a skipped failed outline is retried later', () => {
    const existingScenes = [
      { id: 'scene-1', order: 1, title: '认识面积' },
      { id: 'scene-2', order: 2, title: '什么是面积' },
      { id: 'scene-3', order: 3, title: '用小方格测量面积' },
      { id: 'scene-5', order: 5, title: '长方形面积公式' },
    ];

    const nextScenes = upsertSceneByOrder(existingScenes, {
      id: 'scene-4',
      order: 4,
      title: '数方格小游戏',
    });

    expect(nextScenes.map((scene) => scene.order)).toEqual([1, 2, 3, 4, 5]);
  });

  it('replaces a duplicate scene for the same order instead of appending it', () => {
    const nextScenes = upsertSceneByOrder(
      [
        { id: 'old-scene-4', order: 4, title: '旧的数方格小游戏' },
        { id: 'scene-5', order: 5, title: '长方形面积公式' },
      ],
      { id: 'new-scene-4', order: 4, title: '数方格小游戏' },
    );

    expect(nextScenes).toEqual([
      { id: 'new-scene-4', order: 4, title: '数方格小游戏' },
      { id: 'scene-5', order: 5, title: '长方形面积公式' },
    ]);
  });

  it('treats a failed outline as retryable', () => {
    const outline = { id: 'outline-5', order: 5, title: '诗意地图' };

    expect(
      getRetryableOutline(
        {
          failedOutlines: [outline],
          generatingOutlines: [],
          generationStatus: 'paused',
        },
        outline.id,
      ),
    ).toBe(outline);
  });

  it('treats a paused pending outline as retryable even when it is not failed', () => {
    const outline = { id: 'outline-5', order: 5, title: '诗意地图' };

    expect(
      isRetryableOutline(
        {
          failedOutlines: [],
          generatingOutlines: [outline],
          generationStatus: 'paused',
        },
        outline.id,
      ),
    ).toBe(true);
  });

  it('does not treat an actively generating outline as retryable', () => {
    const outline = { id: 'outline-5', order: 5, title: '诗意地图' };

    expect(
      isRetryableOutline(
        {
          failedOutlines: [],
          generatingOutlines: [outline],
          generationStatus: 'generating',
        },
        outline.id,
      ),
    ).toBe(false);
  });
});
