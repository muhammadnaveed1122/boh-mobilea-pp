import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/atoms/Text';
import { AppMainHeader } from '@/components/organisms';
import { PropertyListing } from '@/features/properties/components/PropertyListing';
import { useAuthStore } from '@/store/auth.store';
import { ProjectListing } from './ProjectListing';

type HomeTab = 'buy' | 'rent' | 'project';

const TABS: { value: HomeTab; label: string; disabled?: boolean }[] = [
  { value: 'buy', label: 'Buy' },
  { value: 'rent', label: 'Rent' },
  { value: 'project', label: 'Projects' },
];

function TabBar({
  active,
  onChange,
}: Readonly<{ active: HomeTab; onChange: (t: HomeTab) => void }>) {
  return (
    <View className="mt-2 flex-row gap-2 px-4">
      {TABS.map((t) => {
        const isActive = active === t.value;
        return (
          <Pressable
            key={t.value}
            onPress={() => onChange(t.value)}
            disabled={t.disabled}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive, disabled: Boolean(t.disabled) }}
            style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}
            className={`min-h-11 justify-center rounded-full px-5 py-2 ${isActive ? 'bg-foreground' : 'border border-border bg-background'} ${t.disabled ? 'opacity-40' : ''}`}
          >
            <Text
              className={`text-sm font-semibold ${isActive ? 'text-background' : 'text-foreground'}`}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [tab, setTab] = useState<HomeTab>('buy');

  const bottomPad = 120 + insets.bottom;

  return (
    <View
      className="flex-1 bg-background"
      style={isAuthenticated ? undefined : { paddingTop: insets.top }}
    >
      {isAuthenticated ? <AppMainHeader /> : null}
      {/* Compact greeting: this is static chrome, so it yields space to the list. */}
      <View className="px-4 pb-0.5 pt-2">
        <Text className="text-xl font-bold leading-7 text-foreground">Welcome!</Text>
        <Text className="text-xs text-muted-foreground">Find your dream property with RHK</Text>
      </View>

      <TabBar active={tab} onChange={setTab} />

      <View className="mt-1.5 flex-1">
        {tab === 'project' ? <ProjectListing contentBottomPadding={bottomPad} /> : null}
        {tab === 'buy' ? (
          <PropertyListing listingType="buy" contentBottomPadding={bottomPad} />
        ) : null}
        {tab === 'rent' ? (
          <PropertyListing listingType="rent" contentBottomPadding={bottomPad} />
        ) : null}
      </View>
    </View>
  );
}
