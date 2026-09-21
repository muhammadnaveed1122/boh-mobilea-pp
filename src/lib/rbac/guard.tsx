import type { ReactNode } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { hasAnyRole } from './selectors';

interface RoleGuardProps {
  allow: readonly string[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RoleGuard({ allow, children, fallback = null }: RoleGuardProps): ReactNode {
  const user = useAuthStore((s) => s.user);
  const allowed = hasAnyRole(user, allow);
  return allowed ? <>{children}</> : <>{fallback}</>;
}
