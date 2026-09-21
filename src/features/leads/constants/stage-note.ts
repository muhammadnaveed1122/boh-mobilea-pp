/**
 * Stage-change note rules — shared by every surface that can move a lead between
 * stages, so one gate covers them all.
 *
 * The note is mandatory: it is the audit trail for *why* the lead moved, and the
 * backend mirrors it into the lead's Notes collection. These bounds are a client
 * rule only — `UpdateLeadDto.note` is optional server-side and caps at 1000, so
 * anything that skips this module can still move a stage without a note.
 */

export const STAGE_NOTE_MIN = 15;
export const STAGE_NOTE_MAX = 500;

/**
 * Validate a stage-change note. Returns a user-facing message, or `null` when
 * the note is acceptable. Length is measured on the trimmed value — the same
 * value that gets sent to the API.
 */
export function stageNoteError(note: string): string | null {
  const trimmed = note.trim();
  if (trimmed.length === 0) {
    return 'A note is required to change the stage.';
  }
  if (trimmed.length < STAGE_NOTE_MIN) {
    return `Note must be at least ${STAGE_NOTE_MIN} characters (${trimmed.length}/${STAGE_NOTE_MIN}).`;
  }
  if (trimmed.length > STAGE_NOTE_MAX) {
    return `Note must be at most ${STAGE_NOTE_MAX} characters.`;
  }
  return null;
}
