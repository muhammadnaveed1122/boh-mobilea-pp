import { useMutation } from '@tanstack/react-query';
import { initiateCallback, type CallbackPayload } from '../services';

export function useCallback_() {
  return useMutation<void, Error, CallbackPayload>({
    mutationFn: (body) => initiateCallback(body),
  });
}
