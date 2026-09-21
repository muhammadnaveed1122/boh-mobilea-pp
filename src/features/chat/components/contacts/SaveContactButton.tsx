/**
 * "Add to contacts" affordance for a conversation header. Renders nothing for
 * shared-number agents (the phonebook 403s for them) and collapses to a static
 * "saved" marker once the number is already in the phonebook.
 *
 * The name prompt is prefilled with the WhatsApp profile name when one is
 * known, but stays compulsory — see `AddContactSheet`.
 */

import { useCallback, useRef } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import { useContactsAvailable } from '../../hooks/use-agent-contacts';
import { useContactNames } from '../../hooks/use-contact-names';
import { AddContactSheet, type AddContactSheetHandle } from './AddContactSheet';

interface Props {
  phone?: string | null;
  /** WhatsApp profile name, used to prefill the name field. */
  profileName?: string | null;
  /** Renders a labelled row instead of a bare icon button. */
  withLabel?: boolean;
}

export function SaveContactButton({ phone, profileName, withLabel = false }: Readonly<Props>) {
  const available = useContactsAvailable();
  const { isSaved } = useContactNames();
  const sheetRef = useRef<AddContactSheetHandle>(null);
  const foreground = useThemeColor('--foreground');
  const primary = useThemeColor('--primary');

  const hasPhone = phone !== undefined && phone !== null && phone !== '';

  const open = useCallback(() => {
    // A number-only "profile name" is the raw phone echoed back — not a name.
    const prefill = profileName && /[a-zA-Z]/.test(profileName) ? profileName : '';
    sheetRef.current?.open({ name: prefill, phone: phone ?? '' });
  }, [phone, profileName]);

  if (!available || !hasPhone) return null;

  if (isSaved(phone)) {
    return (
      <View
        className="flex-row items-center gap-1.5"
        accessible
        accessibilityLabel="Saved in your contacts"
      >
        <Icon name="BookmarkCheck" size={18} color={primary} />
        {withLabel ? <Text className="text-sm text-muted-foreground">In your contacts</Text> : null}
      </View>
    );
  }

  return (
    <>
      <Pressable
        onPress={open}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Add to contacts"
        className={
          withLabel
            ? 'h-11 flex-row items-center gap-2 rounded-xl px-2'
            : 'h-11 w-11 items-center justify-center rounded-xl'
        }
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <Icon name="UserPlus" size={20} color={foreground} />
        {withLabel ? <Text className="text-sm text-foreground">Add to contacts</Text> : null}
      </Pressable>
      <AddContactSheet ref={sheetRef} />
    </>
  );
}
