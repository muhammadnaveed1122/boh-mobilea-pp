import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addToDnc, removeFromDnc } from '../services';

export function useDncMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['dnc-check'] }).catch(() => {});
  };

  const add = useMutation<void, Error, { phone: string; note?: string }>({
    mutationFn: (body) => addToDnc(body),
    onSuccess: invalidate,
  });

  const remove = useMutation<void, Error, string>({
    mutationFn: (phone) => removeFromDnc(phone),
    onSuccess: invalidate,
  });

  return { add, remove };
}
