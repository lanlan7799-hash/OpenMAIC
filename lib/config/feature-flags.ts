/**
 * Build-time feature flags. Values come from `NEXT_PUBLIC_*` env vars,
 * which Next.js inlines at build time so they are safe to read from
 * client components.
 *
 * Explicit false values: `'false'` or `'0'`. Anything else (including unset)
 * is treated as enabled for now so FamilyBuddy student/parent clients can
 * access MAIC Editor while role gating is deferred.
 */

function readEnabledByDefault(envValue: string | undefined): boolean {
  return envValue !== 'false' && envValue !== '0';
}

/**
 * MAIC Editor (Pro mode) gate. Default ON — gates only the Pro toggle
 * affordance in `Header`. The `StageMode` type union is unaffected so
 * existing code paths typecheck identically with the flag in either
 * state.
 */
export function isMaicEditorEnabled(): boolean {
  return readEnabledByDefault(process.env.NEXT_PUBLIC_MAIC_EDITOR_ENABLED);
}
