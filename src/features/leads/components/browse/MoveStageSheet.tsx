/**
 * MoveStageSheet — the browse-list "Move stage" action. Thin wrapper over the
 * shared `StageNoteSheet` so this path enforces the same mandatory note as the
 * lead-detail status badge (it previously wrote the stage straight through with
 * no note, bypassing the audit trail).
 */

import { StageNoteSheet } from '../selectors/StageNoteSheet';
import { BOARD_STAGE_ORDER } from '@/features/leads/constants/board';

export function MoveStageSheet({
  leadId,
  currentStatus,
  visible,
  onClose,
}: Readonly<{
  leadId: string | null;
  currentStatus: string | null;
  visible: boolean;
  onClose: () => void;
}>) {
  if (!leadId) return null;
  return (
    <StageNoteSheet
      leadId={leadId}
      currentStatus={currentStatus ?? ''}
      stages={BOARD_STAGE_ORDER}
      visible={visible}
      onClose={onClose}
    />
  );
}
