import { Modal, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Text } from '@/components/atoms/Text';
import type { LeadListItem } from '@/features/leads/types';

export function LeadActionSheet({
  lead,
  visible,
  onClose,
  onMoveStage,
  onAssign,
}: Readonly<{
  lead: LeadListItem | null;
  visible: boolean;
  onClose: () => void;
  onMoveStage: (lead: LeadListItem) => void;
  onAssign: (lead: LeadListItem) => void;
}>) {
  if (!lead) return null;
  const rows: { label: string; run: () => void }[] = [
    { label: 'Move stage', run: () => onMoveStage(lead) },
    { label: 'Assign', run: () => onAssign(lead) },
    { label: 'Open detail', run: () => router.push(`/leads/${lead.id}`) },
  ];
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 justify-end bg-black/40">
        <Pressable className="rounded-t-3xl bg-card p-4 pb-8" onPress={() => {}}>
          <Text className="mb-2 text-base font-extrabold text-foreground">
            {lead.name ?? 'Lead'}
          </Text>
          {rows.map((r) => (
            <Pressable
              key={r.label}
              onPress={() => {
                onClose();
                r.run();
              }}
              style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
              className="border-b border-border py-4"
            >
              <Text className="text-[15px] font-semibold text-foreground">{r.label}</Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
