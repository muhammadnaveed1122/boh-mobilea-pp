import * as React from 'react';
import * as LabelPrimitive from '@rn-primitives/label';
import { cn } from '@/lib/utils';

export const Label = React.forwardRef<
  React.ComponentRef<typeof LabelPrimitive.Text>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Text> & {
    onPress?: () => void;
  }
>(({ className, onPress, ...props }, ref) => (
  <LabelPrimitive.Root>
    <LabelPrimitive.Text
      ref={ref}
      onPress={onPress}
      className={cn(
        'text-sm font-medium leading-none text-foreground',
        'native:text-base',
        props.disabled && 'opacity-70',
        className,
      )}
      {...props}
    />
  </LabelPrimitive.Root>
));
Label.displayName = 'Label';
