type QueueItem = {
  id: string;
  order: number;
};

type OrderedItem = {
  order: number;
};

type GenerationStatus = 'idle' | 'generating' | 'paused' | 'completed' | 'error';

type RetryableOutlineState<T extends QueueItem> = {
  failedOutlines: readonly T[];
  generatingOutlines: readonly T[];
  generationStatus: GenerationStatus;
};

export function deferOutlineToQueueEnd<T extends QueueItem>(queue: readonly T[], outline: T): T[] {
  const remaining = queue.filter((item) => item.id !== outline.id);
  return [...remaining, outline];
}

export function removeOutlineFromQueue<T extends QueueItem>(
  queue: readonly T[],
  outlineId: string,
): T[] {
  return queue.filter((item) => item.id !== outlineId);
}

export function upsertSceneByOrder<T extends OrderedItem>(scenes: readonly T[], scene: T): T[] {
  return [...scenes.filter((item) => item.order !== scene.order), scene].sort(
    (a, b) => a.order - b.order,
  );
}

export function getRetryableOutline<T extends QueueItem>(
  state: RetryableOutlineState<T>,
  outlineId: string,
): T | undefined {
  const failedOutline = state.failedOutlines.find((outline) => outline.id === outlineId);
  if (failedOutline) return failedOutline;

  if (state.generationStatus !== 'paused' && state.generationStatus !== 'error') return undefined;

  return state.generatingOutlines.find((outline) => outline.id === outlineId);
}

export function isRetryableOutline<T extends QueueItem>(
  state: RetryableOutlineState<T>,
  outlineId: string,
): boolean {
  return !!getRetryableOutline(state, outlineId);
}
