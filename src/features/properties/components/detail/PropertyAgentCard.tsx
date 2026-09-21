import { View } from 'react-native';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/atoms/Avatar';
import { Text } from '@/components/atoms/Text';
import { initials } from '@/lib/format/initials';
import type { PropertyAgent } from '../../types';

export function PropertyAgentCard({ agent }: Readonly<{ agent?: PropertyAgent }>) {
  if (!agent?.name) return null;
  return (
    <View className="mx-4 mt-6 overflow-hidden rounded-2xl bg-brand p-4">
      <Text className="mb-3 text-sm font-semibold text-brand-foreground/70">Presented by</Text>
      <View className="flex-row items-center gap-3">
        <Avatar alt={agent.name} className="h-14 w-14 bg-brand-foreground/15">
          {agent.avatarUrl ? <AvatarImage source={{ uri: agent.avatarUrl }} /> : null}
          <AvatarFallback className="bg-brand-foreground/15">
            <Text className="text-base font-bold text-brand-foreground">
              {initials(agent.name)}
            </Text>
          </AvatarFallback>
        </Avatar>
        <View className="min-w-0 flex-1">
          <Text className="text-base font-bold text-brand-foreground" numberOfLines={1}>
            {agent.name}
          </Text>
          {agent.role ? (
            <Text className="text-xs text-brand-foreground/70" numberOfLines={1}>
              {agent.role}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}
