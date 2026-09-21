import * as React from 'react';
import { Platform } from 'react-native';
import * as CheckboxPrimitive from '@rn-primitives/checkbox';
import { Check } from 'lucide-react-native';
import { cn } from '@/lib/utils';
import { useThemeColor } from '@theme';

export const Checkbox = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => {
  const primaryFg = useThemeColor('--primary-foreground');
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        'h-5 w-5 shrink-0 items-center justify-center rounded-sm border-2 border-primary bg-transparent',
        props.checked && 'bg-primary',
        props.disabled && 'opacity-50',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="items-center justify-center">
        <Check size={Platform.OS === 'web' ? 14 : 12} strokeWidth={3.5} color={primaryFg} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
Checkbox.displayName = 'Checkbox';
