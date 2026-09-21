import { useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import { AuthChooser } from '@/features/auth/components/AuthChooser';
import { AuthForm } from '@/features/auth/components/AuthForm';

type AuthView = 'chooser' | 'form';

interface AuthFlowProps {
  /** Forwarded to social + email sign-in success (defaults to entering the app). */
  onAuthSuccess?: () => void;
  /** Forwarded to AuthForm for pre-navigation cleanup (modal close). */
  onNavigateAway?: () => void;
}

/**
 * Chooser-first auth container. Shows the method picker, then swaps to the
 * tabbed email/password form when the user chooses email. Shared by the
 * full-screen login screen and the in-app AuthPromptModal.
 */
export function AuthFlow({ onAuthSuccess, onNavigateAway }: Readonly<AuthFlowProps>) {
  const [view, setView] = useState<AuthView>('chooser');

  // Android hardware back: from the form, return to the chooser instead of
  // leaving the auth surface. From the chooser, we INTENTIONALLY fall through
  // to default (do not register a listener) — on the full-screen login this
  // exits the app (login is always a stack root, reached via <Redirect>), and
  // in the AuthPromptModal it lets the Dialog's onRequestClose dismiss the
  // modal. Registering a swallowing listener here would break both. Leave it.
  useEffect(() => {
    if (view !== 'form') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setView('chooser');
      return true;
    });
    return () => sub.remove();
  }, [view]);

  if (view === 'form') {
    return (
      <AuthForm
        onAuthSuccess={onAuthSuccess}
        onNavigateAway={onNavigateAway}
        onBack={() => setView('chooser')}
      />
    );
  }

  return <AuthChooser onEmailPress={() => setView('form')} onAuthSuccess={onAuthSuccess} />;
}
