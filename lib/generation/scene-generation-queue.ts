type QueueItem = {
  id: string;
  order: number;
};

type OrderedItem = {
  order: number;
};

export function deferOutlineToQueueEnd<T extends QueueItem>(
  queue: readonly T[],
  outline: T,
): T[] {
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
