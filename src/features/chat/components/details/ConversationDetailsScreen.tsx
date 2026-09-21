import { ActivityIndicator, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { Card } from '@/components/molecules/Card';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import { getConversation } from '../../api/services';
import { chatKeys } from '../../hooks/keys';
import { ContactDetailsCard } from './ContactDetailsCard';
import { LabelsCard } from './LabelsCard';
import { LeadCard } from './LeadCard';
import { NotesCard } from './NotesCard';
import { ProfileCard } from './ProfileCard';
import { NAVY_GRADIENT } from './navy-gradient';
import { SharedMediaCard } from './SharedMediaCard';

const NAVY_HEADER = NAVY_GRADIENT[0];

interface Props {
  conversationId: string;
  channel: string;
  leadId?: string;
}

export function ConversationDetailsScreen({ conversationId, channel, leadId }: Readonly<Props>) {
  const insets = useSafeAreaInsets();
  const primary = useThemeColor('--primary');

  const convQuery = useQuery({
    queryKey: chatKeys.conversation(conversationId),
    queryFn: () => getConversation(conversationId),
    enabled: !!conversationId,
  });
  const conv = convQuery.data;
  const name = conv?.customerName ?? 'Unknown contact';
  const effectiveLeadId = conv?.leadId || leadId || undefined;

  return (
    <View className="flex-1 bg-background">
      <View style={{ paddingTop: insets.top + 8, backgroundColor: NAVY_HEADER }}>
        <View className="flex-row items-center px-3 pb-4 pt-1">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/chat'))}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="h-10 w-10 items-center justify-center rounded-xl active:opacity-70"
          >
            <Icon name="ArrowLeft" size={20} color="#FFFFFF" />
          </Pressable>
          <Text className="ml-1 text-base font-bold text-white">Details</Text>
        </View>
      </View>

      {convQuery.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={primary} />
        </View>
      ) : (
        <KeyboardAwareScrollView
          bottomOffset={16}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 16 }}
        >
          <Card>
            <ProfileCard name={name} channel={channel} />
          </Card>
          <Card>
            <ContactDetailsCard phone={conv?.customerPhone} email={conv?.customerEmail} />
          </Card>
          <Card>
            <LeadCard
              conversationId={conversationId}
              channel={channel}
              leadId={effectiveLeadId}
              contactName={name}
              phone={conv?.customerPhone}
              email={conv?.customerEmail}
            />
          </Card>
          <Card>
            <LabelsCard conversationId={conversationId} />
          </Card>
          {effectiveLeadId ? (
            <Card>
              <NotesCard leadId={effectiveLeadId} />
            </Card>
          ) : (
            <Card>
              <View className="gap-2 px-4 py-3">
                <Text className="text-base font-semibold">Notes</Text>
                <Text className="text-sm text-muted-foreground">
                  Link this conversation to a Lead to add notes.
                </Text>
              </View>
            </Card>
          )}
          <Card>
            <SharedMediaCard conversationId={conversationId} />
          </Card>
        </KeyboardAwareScrollView>
      )}
    </View>
  );
}
