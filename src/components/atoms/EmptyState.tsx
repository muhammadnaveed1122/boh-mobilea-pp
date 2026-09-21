import { View } from 'react-native';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

interface Props {
  icon?: IconName;
  title: string;
  description?: string;
}

/**
 * Centered empty/zero-state: round muted icon chip + title + optional
 * description. Uses Icon + Text atoms and semantic tokens only.
 */
export function EmptyState({ icon = 'Inbox', title, description }: Readonly<Props>) {
  return (
    <View className="items-center justify-center gap-2 px-8 py-16">
      <View className="mb-2 h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Icon name={icon} size={26} />
      </View>
      <Text variant="subheading" className="text-center">
        {title}
      </Text>
      {description ? (
        <Text variant="muted" className="text-center">
          {description}
        </Text>
      ) : null}
    </View>
  );
}
