import type { ReactNode } from 'react';
import { useCan, useCanAll } from './use-can';

interface BaseProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface SinglePermissionProps extends BaseProps {
  permission: string;
  anyOf?: never;
  allOf?: never;
}

interface AnyOfProps extends BaseProps {
  permission?: never;
  anyOf: readonly string[];
  allOf?: never;
}

interface AllOfProps extends BaseProps {
  permission?: never;
  anyOf?: never;
  allOf: readonly string[];
}

export type CanProps = SinglePermissionProps | AnyOfProps | AllOfProps;

export function Can(props: CanProps): ReactNode {
  const { children, fallback = null } = props;

  const single = 'permission' in props && props.permission ? props.permission : null;
  const anyCodes = 'anyOf' in props && props.anyOf ? props.anyOf : null;
  const allCodes = 'allOf' in props && props.allOf ? props.allOf : null;

  const allowedSingle = useCan(single ?? '');
  const allowedAny = useCan(anyCodes ?? []);
  const allowedAll = useCanAll(allCodes ?? []);

  const allowed = single ? allowedSingle : anyCodes ? allowedAny : allCodes ? allowedAll : false;

  return allowed ? <>{children}</> : <>{fallback}</>;
}
