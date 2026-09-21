/**
 * Shared broadcast composer — template pick, optional `{{1}}` parameter, and
 * optional listing attachment. Used by both the ad-hoc multi-send screen and
 * the channel view, so the two surfaces cannot drift apart.
 *
 * Templates whose header is an IMAGE component REQUIRE an attached listing:
 * Meta rejects an image-header send with no media (error 131008), so the send
 * button stays disabled until one is picked rather than letting the blast fail
 * per-recipient.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { EmptyState } from '@/components/atoms/EmptyState';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import { requiresHeaderImage } from '../../api/template-header';
import type { ApiWhatsappTemplate } from '../../api/types';
import { useWhatsappTemplates } from '../../hooks/use-whatsapp-templates';
import type { BroadcastTemplateInput, ListingCard } from '../../models/contact';
import { Input } from '@/components/atoms/Input';
import { ListingAttachment } from './ListingAttachment';
import { ListingPickerSheet, type ListingPickerSheetHandle } from './ListingPickerSheet';

interface Props {
  /** How many contacts this blast will reach — drives the send button label. */
  recipientCount: number;
  isSending: boolean;
  onSend: (input: BroadcastTemplateInput) => void;
  /** Renders the composer without its own scroll container (channel view). */
  compact?: boolean;
}

export function BroadcastForm({
  recipientCount,
  isSending,
  onSend,
  compact = false,
}: Readonly<Props>) {
  const primary = useThemeColor('--primary');
  const primaryForeground = useThemeColor('--primary-foreground');
  const mutedFg = useThemeColor('--muted-foreground');
  const listingSheet = useRef<ListingPickerSheetHandle>(null);

  const { data, isLoading } = useWhatsappTemplates();
  const templates = useMemo(() => (data ?? []).filter((t) => t.status === 'APPROVED'), [data]);

  const [selected, setSelected] = useState<ApiWhatsappTemplate | null>(null);
  const [param, setParam] = useState('');
  const [listing, setListing] = useState<ListingCard | null>(null);

  const needsListing = requiresHeaderImage(selected);
  const missingListing = needsListing && listing === null;
  const canSend = selected !== null && recipientCount > 0 && !missingListing && !isSending;

  const handleSend = useCallback(() => {
    if (!canSend || selected === null) return;
    const trimmedParam = param.trim();
    onSend({
      templateName: selected.name,
      templateLanguage: selected.language,
      content: trimmedParam === '' ? undefined : trimmedParam,
      headerImageUrl: listing?.imageUrl,
    });
  }, [canSend, listing, onSend, param, selected]);

  if (isLoading) {
    return (
      <View className="items-center justify-center py-8">
        <ActivityIndicator color={primary} />
      </View>
    );
  }

  if (templates.length === 0) {
    return (
      <EmptyState
        icon="Inbox"
        title="No approved templates"
        description="Broadcasts must use an approved WhatsApp template. Ask an admin to create one."
      />
    );
  }

  const body = (
    <View className="gap-4">
      <View className="gap-2">
        <Text variant="label">Template</Text>
        {templates.map((t) => {
          const isActive = selected?.id === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setSelected(t)}
              accessibilityRole="radio"
              accessibilityLabel={t.name}
              accessibilityState={{ selected: isActive }}
              className={
                isActive
                  ? 'rounded-2xl border-2 border-primary bg-card p-3'
                  : 'rounded-2xl border border-border bg-card p-3'
              }
              style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
            >
              <View className="flex-row items-center gap-2">
                <Text className="flex-1 text-sm font-semibold text-foreground" numberOfLines={1}>
                  {t.name}
                </Text>
                {requiresHeaderImage(t) ? (
                  <View className="flex-row items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                    <Icon name="Image" size={12} color={mutedFg} />
                    <Text className="text-[10px] text-muted-foreground">Needs photo</Text>
                  </View>
                ) : null}
              </View>
              {t.body ? (
                <Text variant="muted" numberOfLines={3} className="mt-1">
                  {t.body}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View className="gap-2">
        <Text variant="label">Message detail (optional)</Text>
        <Input
          value={param}
          onChangeText={setParam}
          placeholder="Fills the template's first placeholder"
          placeholderTextColor={mutedFg}
        />
      </View>

      <ListingAttachment
        listing={listing}
        required={needsListing}
        onPick={() => listingSheet.current?.open()}
        onClear={() => setListing(null)}
      />

      <Pressable
        onPress={handleSend}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel={`Send to ${recipientCount} contacts`}
        accessibilityState={{ disabled: !canSend }}
        className="h-12 flex-row items-center justify-center gap-2 rounded-xl bg-primary active:opacity-80"
        style={{ opacity: canSend ? 1 : 0.5 }}
      >
        {isSending ? (
          <ActivityIndicator color={primaryForeground} />
        ) : (
          <>
            <Icon name="Send" size={18} color={primaryForeground} />
            <Text className="font-semibold text-primary-foreground">
              Send to {recipientCount} contact{recipientCount === 1 ? '' : 's'}
            </Text>
          </>
        )}
      </Pressable>

      <ListingPickerSheet ref={listingSheet} onPick={setListing} />
    </View>
  );

  if (compact) return body;

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {body}
    </ScrollView>
  );
}
