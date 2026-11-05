/**
 * The colour a project is drawn in: the dot beside its name in a rehearsal's
 * row (T-036).
 *
 * Projects have no colour of their own yet — `native_projects.color` is the
 * same purple for every one, and nothing lets anyone choose it — so the colour
 * is the project's id, mapped onto the palette below. The same id is always
 * the same colour, on every screen and every launch, the way an avatar keeps
 * its colour by its name.
 *
 * Kept away from the colours that already mean something (T-031): purple is
 * doing and choosing, green free, red busy, yellow the phone's calendar, and
 * there is no blue. Each is at least 3:1 against `bg.secondary`, the rows'
 * ground. `projectColor.test.ts` holds both.
 */
export const PROJECT_PALETTE = [
  '#F472B6', // pink
  '#22D3EE', // cyan
  '#A3E635', // lime
  '#D6B38A', // sand
  '#FDA4AF', // salmon
  '#E2E8F0', // silver
] as const;

export function projectColor(projectId: string | number | null | undefined): string {
  const key = String(projectId ?? '');
  // The avatar's hash (UserAvatar): a string's characters folded into 32 bits.
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (key.charCodeAt(i) + ((hash << 5) - hash)) | 0;
  }
  return PROJECT_PALETTE[Math.abs(hash) % PROJECT_PALETTE.length];
}
