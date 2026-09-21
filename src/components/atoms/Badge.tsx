import * as React from 'react';
import { View, type ViewProps } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { TextClassContext } from './Text';

const badgeVariants = cva(
  'flex-row items-center rounded-full border border-transparent px-2.5 py-0.5',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary',
        secondary: 'border-transparent bg-secondary',
        destructive: 'border-transparent bg-destructive',
        success: 'border-transparent bg-success',
        info: 'border-transparent bg-info',
        warning: 'border-transparent bg-warning',
        outline: 'border-border bg-transparent',
        ghost: 'border-transparent bg-white/15',
        successSoft: 'border-transparent bg-success/15 dark:bg-success/20',
        infoSoft: 'border-transparent bg-info/15 dark:bg-info/20',
        warningSoft: 'border-transparent bg-warning/15 dark:bg-warning/25',
        destructiveSoft: 'border-transparent bg-destructive/15 dark:bg-destructive/20',
        mutedSoft: 'border-transparent bg-muted-foreground/15 dark:bg-muted-foreground/20',
        brandSoft: 'border-transparent bg-brand/15 dark:bg-brand/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

const badgeTextVariants = cva('text-xs font-semibold', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      secondary: 'text-secondary-foreground',
      destructive: 'text-destructive-foreground',
      success: 'text-success-foreground',
      info: 'text-info-foreground',
      warning: 'text-warning-foreground',
      outline: 'text-foreground',
      ghost: 'text-white',
      successSoft: 'text-success',
      infoSoft: 'text-info',
      warningSoft: 'text-warning',
      destructiveSoft: 'text-destructive',
      mutedSoft: 'text-muted-foreground',
      brandSoft: 'text-brand',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export interface BadgeProps extends ViewProps, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, children, ...props }: BadgeProps) {
  return (
    <TextClassContext.Provider value={badgeTextVariants({ variant })}>
      <View className={cn(badgeVariants({ variant }), className)} {...props}>
        {children}
      </View>
    </TextClassContext.Provider>
  );
}

export { badgeTextVariants, badgeVariants };
