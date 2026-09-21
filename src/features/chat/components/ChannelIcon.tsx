import { Icon } from '@/components/atoms/Icon';
import { MessengerIcon, WhatsappIcon } from '@/components/atoms/icons';

import type { Channel } from '../models/channel';

interface Props {
  channel: Channel;
  size?: number;
  color?: string;
}

/** Per-channel mark: brand glyphs for WhatsApp/Messenger, Lucide Mail for email. */
export function ChannelIcon({ channel, size = 14, color }: Readonly<Props>) {
  switch (channel) {
    case 'whatsapp':
      return <WhatsappIcon size={size} color={color} />;
    case 'messenger':
      return <MessengerIcon size={size} color={color} />;
    default:
      return <Icon name="Mail" size={size} color={color} />;
  }
}
