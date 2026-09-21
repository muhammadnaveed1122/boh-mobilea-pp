import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import type { ListingCallContext, PropertyAgent } from '../../types';
import { buildInquiryWhatsAppUrl } from '../../utils/inquiry';
import { ListingCallDialog } from './ListingCallDialog';

function openUrl(url: string): void {
  Linking.openURL(url).catch(() => undefined);
}

interface Props {
  priceLabel: string;
  /** Assigned agent shown in the Call dialog. */
  agent?: PropertyAgent;
  /** Enquiry context so WhatsApp opens pre-filled the same way the web buttons do. */
  propertyName: string;
  /** Listing attribution + reference for the Call dialog and the WhatsApp message. */
  callContext: ListingCallContext;
}

export function PropertyContactBar({
  priceLabel,
  agent,
  propertyName,
  callContext,
}: Readonly<Props>) {
  const insets = useSafeAreaInsets();
  const [callOpen, setCallOpen] = useState(false);
  // WhatsApp always goes to the company number, never the assigned agent — matches web.
  const waUrl = buildInquiryWhatsAppUrl(propertyName, {
    reference: callContext.reference,
    fallbackId: callContext.listingId ?? callContext.opportunityListingId,
    propertyUrl: callContext.pageUrl,
  });

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
            Unit Price
          </Text>
          <Text className="text-base font-bold text-foreground" numberOfLines={1}>
            {priceLabel}
          </Text>
        </View>
        {/* Call opens the same three-step popup web shows (contact → callback form → confirmation)
            rather than dialling straight away, so the caller sees the reference to quote. */}
        <Pressable
          onPress={() => setCallOpen(true)}
          accessibilityLabel="Call"
          className="h-12 flex-row items-center justify-center gap-2 rounded-full border border-border bg-background px-5 active:opacity-80"
        >
          <Icon name="Phone" size={16} />
          <Text className="text-sm font-semibold text-foreground">Call</Text>
        </Pressable>
        <Pressable
          onPress={() => openUrl(waUrl)}
          accessibilityLabel="WhatsApp"
          className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-full px-5 active:opacity-90"
          style={{ backgroundColor: '#25D366' }}
        >
          <Icon name="MessageCircle" size={16} color="#fff" />
          <Text className="text-sm font-semibold text-white">WhatsApp</Text>
        </Pressable>
      </View>

      <ListingCallDialog
        visible={callOpen}
        onClose={() => setCallOpen(false)}
        agent={agent}
        context={callContext}
      />
    </View>
  );
}
