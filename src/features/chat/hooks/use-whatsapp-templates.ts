import { useQuery } from '@tanstack/react-query';

import { getWhatsappTemplates } from '../api/services';
import { chatKeys } from './keys';

/** Lists WhatsApp templates. Caller filters by `status`. */
export function useWhatsappTemplates() {
  return useQuery({
    queryKey: chatKeys.whatsappTemplates(),
    queryFn: getWhatsappTemplates,
  });
}
