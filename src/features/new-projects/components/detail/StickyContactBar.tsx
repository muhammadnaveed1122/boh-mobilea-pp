import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { formatAed } from '../../utils/format';

interface Props {
  price: number;
  onContact: () => void;
  onBrochure?: () => void;
}

export function StickyContactBar({ price, onContact, onBrochure }: Readonly<Props>) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="absolute inset-x-0 bottom-0 border-t border-border bg-card"
      style={{
        paddingBottom: insets.bottom + 10,
        paddingTop: 12,
        paddingHorizontal: 16,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: -2 },
        elevation: 8,
      }}
    >
      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <Text className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Starting from
          </Text>
          <Text className="text-base font-bold text-foreground" numberOfLines={1}>
            {formatAed(price)}
          </Text>
        </View>
        {onBrochure ? (
          <Pressable
            onPress={onBrochure}
            className="h-12 w-12 items-center justify-center rounded-full border border-border bg-background active:opacity-70"
            accessibilityLabel="Download brochure"
          >
            <Icon name="Download" size={18} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={onContact}
          className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-full bg-brand px-5 active:opacity-90"
          accessibilityLabel="Contact us"
        >
          <Icon name="MessageCircle" size={16} color="white" />
          <Text className="text-sm font-semibold text-brand-foreground">Contact Us</Text>
        </Pressable>
      </View>
    </View>
  );
}
