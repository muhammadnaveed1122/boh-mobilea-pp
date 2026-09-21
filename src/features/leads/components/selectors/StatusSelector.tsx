/**
 * StatusSelector — tap a status pill to change a lead's stage. Mirrors web's
 * `StatusDropdown`: the badge is the trigger, the sheet does the work.
 *
 * The sheet itself is `StageNoteSheet`, shared with the browse-list kebab
 * action, so the mandatory stage-change note is enforced identically wherever
 * the user changes a stage.
 */

import * as React from 'react';
import { Keyboard, Platform, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ChevronDown } from 'lucide-react-native';
import { useThemeColor } from '@theme';
import { Badge } from '@/components/atoms/Badge';
import { Text } from '@/components/atoms/Text';
import { StageNoteSheet } from './StageNoteSheet';
import { type BadgeTone, STATUS_BADGE_VARIANT, STATUS_LABEL } from '../../types';

function statusTone(status: string): BadgeTone {
  return (STATUS_BADGE_VARIANT as Record<string, BadgeTone>)[status] ?? 'mutedSoft';
}

function statusText(status: string): string {
  return (STATUS_LABEL as Record<string, string>)[status] ?? status;
}

function lightHaptic(): void {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export interface StatusSelectorProps {
  readonly leadId: string;
  readonly value: string;
  readonly disabled?: boolean;
}

export function StatusSelector({ leadId, value, disabled = false }: StatusSelectorProps) {
  const [open, setOpen] = React.useState(false);

  const toneColors: Record<BadgeTone, string> = {
    successSoft: useThemeColor('--success'),
    infoSoft: useThemeColor('--info'),
    warningSoft: useThemeColor('--warning'),
    destructiveSoft: useThemeColor('--destructive'),
    mutedSoft: useThemeColor('--muted-foreground'),
  };

  const present = React.useCallback(() => {
    if (disabled) return;
    Keyboard.dismiss();
    lightHaptic();
    setOpen(true);
  }, [disabled]);

  const close = React.useCallback(() => setOpen(false), []);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Change lead stage"
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={present}
        hitSlop={6}
        // Press feedback via the render-prop style, not NativeWind's `active:`
        // variant: on a repeatedly tapped trigger the variant's class swap
        // stalls the native UI thread and taps get dropped.
        style={({ pressed }) => ({ opacity: disabled ? 0.5 : pressed ? 0.7 : 1 })}
      >
        <Badge variant={statusTone(String(value))} className="gap-1">
          <Text>{statusText(String(value))}</Text>
          {disabled ? null : (
            <ChevronDown size={13} color={toneColors[statusTone(String(value))]} />
          )}
        </Badge>
      </Pressable>

      <StageNoteSheet
        leadId={leadId}
        currentStatus={String(value)}
        visible={open}
        onClose={close}
      />
    </>
  );
}
