import type { IconName } from '@/components/atoms/Icon';

/** Messaging channels a single contact thread can interleave. */
export type Channel = 'whatsapp' | 'email' | 'messenger';

/** Filter selector on the conversation screen — `all` shows every channel. */
export type ChannelFilter = 'all' | Channel;

interface ChannelMeta {
  /** Human label used on pills, chips and the composer toggle. */
  label: string;
  /** Lucide icon key (see `@/components/atoms/Icon`). */
  icon: IconName;
  /** Soft Badge variant for the per-message channel chip. */
  chipVariant: 'successSoft' | 'infoSoft';
  /** Semantic accent token name, used for the channel dot. */
  accentToken: '--success' | '--info';
}

export const CHANNEL_META: Record<Channel, ChannelMeta> = {
  whatsapp: {
    label: 'WhatsApp',
    icon: 'MessageCircle',
    chipVariant: 'successSoft',
    accentToken: '--success',
  },
  email: {
    label: 'Email',
    icon: 'Mail',
    chipVariant: 'infoSoft',
    accentToken: '--info',
  },
  messenger: {
    label: 'Messenger',
    icon: 'MessagesSquare',
    chipVariant: 'infoSoft',
    accentToken: '--info',
  },
};

/** Ordered list backing the filter bar (`all` first, then each channel). */
export const CHANNEL_FILTERS: ChannelFilter[] = ['all', 'whatsapp', 'email', 'messenger'];

/** True when a backend channel string denotes a Meta Messenger thread. */
export function isMessengerChannel(channel: string | null | undefined): boolean {
  return (channel ?? '').toLowerCase() === 'messenger';
}
