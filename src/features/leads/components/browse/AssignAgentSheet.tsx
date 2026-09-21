import { Modal, Pressable, ScrollView } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { useAgentsList } from '@/features/leads/hooks/use-agents-list';
import { useAssignLead } from '@/features/leads/hooks/use-lead-mutations';

export function AssignAgentSheet({
  leadId,
  visible,
  onClose,
}: Readonly<{ leadId: string | null; visible: boolean; onClose: () => void }>) {
  const { data } = useAgentsList();
  const assign = useAssignLead();
  if (!leadId) return null;
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 justify-end bg-black/40">
        <Pressable onPress={() => {}} className="max-h-[70%] rounded-t-3xl bg-card p-5">
          <Text className="mb-3 text-lg font-extrabold text-foreground">Assign to</Text>
          <ScrollView>
            {(data?.items ?? []).map((a) => {
              const name =
                [a.firstName, a.lastName].filter(Boolean).join(' ') || a.email || 'Agent';
              return (
                <Pressable
                  key={a.id}
                  disabled={assign.isPending}
                  onPress={() =>
                    assign.mutate({ id: leadId, assigneeId: a.id }, { onSuccess: onClose })
                  }
                  className="border-b border-border py-4"
                >
                  <Text className="text-[15px] font-semibold text-foreground">{name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
