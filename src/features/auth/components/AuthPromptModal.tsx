import { useEffect } from 'react';
import { Dialog } from '@/components/atoms/Dialog';
import { AuthFlow } from '@/features/auth/components/AuthFlow';
import { useAuthStore } from '@/store/auth.store';
import { useAuthPromptStore } from '@/store/auth-prompt.store';

export function AuthPromptModal() {
  const isOpen = useAuthPromptStore((s) => s.isOpen);
  const close = useAuthPromptStore((s) => s.close);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      close();
    }
  }, [isOpen, isAuthenticated, close]);

  return (
    <Dialog visible={isOpen} onRequestClose={close} scrollable>
      <AuthFlow onAuthSuccess={close} onNavigateAway={close} />
    </Dialog>
  );
}
