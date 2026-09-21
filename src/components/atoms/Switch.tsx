import * as React from 'react';
import * as SwitchPrimitive from '@rn-primitives/switch';

import { cn } from '@/lib/utils';

/**
 * RNR-style Switch built on @rn-primitives/switch. Follows the Checkbox.tsx
 * pattern (forwardRef + cn + semantic Tailwind tokens, no hex).
 */
export const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      'h-7 w-12 shrink-0 flex-row items-center rounded-full border-2 border-transparent px-0.5',
      props.checked ? 'bg-primary' : 'bg-input',
      props.disabled && 'opacity-50',
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        'h-5 w-5 rounded-full bg-background shadow-sm',
        props.checked ? 'translate-x-5' : 'translate-x-0',
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = 'Switch';
