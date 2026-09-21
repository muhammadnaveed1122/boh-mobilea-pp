import { Pressable, View } from 'react-native';
import { Sun, Moon, Monitor, type LucideIcon } from 'lucide-react-native';
import { cn } from '@/lib/utils';
import { useTheme, useThemeColor, type ThemePreference } from '@theme';
import { Text } from './Text';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from './DropdownMenu';

const OPTIONS: readonly { value: ThemePreference; label: string; Icon: LucideIcon }[] = [
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
] as const;

export interface ThemeToggleProps {
  className?: string;
  size?: number;
}

export function ThemeToggle({ className, size = 20 }: Readonly<ThemeToggleProps>) {
  const { preference, setPreference } = useTheme();
  const fg = useThemeColor('--foreground');
  const Icon = OPTIONS.find((o) => o.value === preference)?.Icon ?? Monitor;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Theme: ${preference}. Tap to change.`}
          className={cn(
            'h-10 w-10 items-center justify-center rounded-md border border-border bg-card active:bg-accent',
            className,
          )}
        >
          <Icon color={fg} size={size} />
        </Pressable>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        <DropdownMenuRadioGroup
          value={preference}
          onValueChange={(v) => setPreference(v as ThemePreference)}
        >
          {OPTIONS.map(({ value, label, Icon: ItemIcon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <View className="flex-row items-center gap-2">
                <ItemIcon color={fg} size={16} />
                <Text>{label}</Text>
              </View>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
