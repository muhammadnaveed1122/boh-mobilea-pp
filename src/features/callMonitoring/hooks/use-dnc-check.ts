import { useQuery } from '@tanstack/react-query';
import { checkDnc } from '../services';

export function useDncCheck(phones: string[]) {
  return useQuery<Record<string, boolean>, Error>({
    queryKey: ['dnc-check', phones],
    queryFn: () => checkDnc(phones),
    enabled: phones.length > 0,
  });
}
