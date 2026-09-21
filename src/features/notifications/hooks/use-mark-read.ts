import { useMutation, useQueryClient } from '@tanstack/react-query';

import { markAllAsRead, markAsRead } from '../services';
import { useNotificationsStore } from '../store/notifications.store';

/** Optimistically mark one notification read (mirrors web markAsRead). */
export function useMarkRead() {
  const qc = useQueryClient();
  const markOneRead = useNotificationsStore((s) => s.markOneRead);

  return useMutation({
    mutationFn: (id: string) => markAsRead(id),
    onMutate: (id: string) => {
      markOneRead(id);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] }).catch(() => {});
    },
  });
}

/** Optimistically mark all read (mirrors web markAllAsRead). */
export function useMarkAllRead() {
  const qc = useQueryClient();
  const markAllReadLocal = useNotificationsStore((s) => s.markAllRead);

  return useMutation({
    mutationFn: () => markAllAsRead(),
    onMutate: () => {
      markAllReadLocal();
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] }).catch(() => {});
    },
  });
}
