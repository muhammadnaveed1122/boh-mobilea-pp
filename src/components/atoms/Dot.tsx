import * as React from 'react';
import { View } from 'react-native';
import { cn } from '@/lib/utils';

/**
 * Small solid status dot. Defaults to the destructive token — used as an
 * unread / pending indicator (e.g. approvals awaiting the user's action).
 */
export function Dot({ className }: Readonly<{ className?: string }>) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={cn('h-2.5 w-2.5 rounded-full bg-destructive', className)}
    />
  );
}
