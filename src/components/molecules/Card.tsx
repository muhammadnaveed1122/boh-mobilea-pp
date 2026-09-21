import * as React from 'react';
import { View, type ViewProps } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Text, TextClassContext } from '@/components/atoms/Text';

const cardVariants = cva('rounded-xl border shadow-card', {
  variants: {
    variant: {
      default: 'border-border bg-card',
      successSoft: 'border-success/20 bg-success/10 dark:bg-success/15',
      infoSoft: 'border-info/20 bg-info/10 dark:bg-info/15',
      warningSoft: 'border-warning/20 bg-warning/10 dark:bg-warning/20',
      destructiveSoft: 'border-destructive/20 bg-destructive/10 dark:bg-destructive/15',
      mutedSoft: 'border-muted-foreground/15 bg-muted-foreground/10 dark:bg-muted-foreground/15',
      brandSoft: 'border-brand/20 bg-brand-muted dark:bg-brand/15',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const cardTextVariants = cva('', {
  variants: {
    variant: {
      default: 'text-card-foreground',
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

type CardVariant = NonNullable<VariantProps<typeof cardVariants>['variant']>;

const CardVariantContext = React.createContext<CardVariant>('default');

export interface CardProps extends ViewProps, VariantProps<typeof cardVariants> {}

export const Card = React.forwardRef<View, CardProps>(({ className, variant, ...props }, ref) => {
  const resolved: CardVariant = variant ?? 'default';
  return (
    <CardVariantContext.Provider value={resolved}>
      <TextClassContext.Provider value={cardTextVariants({ variant: resolved })}>
        <View
          ref={ref}
          className={cn(cardVariants({ variant: resolved }), className)}
          style={{ elevation: 1 }}
          {...props}
        />
      </TextClassContext.Provider>
    </CardVariantContext.Provider>
  );
});
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<View, ViewProps>(({ className, ...props }, ref) => (
  <View ref={ref} className={cn('flex flex-col gap-1.5 p-4', className)} {...props} />
));
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<
  React.ComponentRef<typeof Text>,
  React.ComponentPropsWithoutRef<typeof Text>
>(({ className, ...props }, ref) => {
  const variant = React.useContext(CardVariantContext);
  return (
    <Text
      ref={ref}
      role="heading"
      aria-level={3}
      className={cn(
        'text-2xl font-semibold tracking-tight',
        cardTextVariants({ variant }),
        className,
      )}
      {...props}
    />
  );
});
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<
  React.ComponentRef<typeof Text>,
  React.ComponentPropsWithoutRef<typeof Text>
>(({ className, ...props }, ref) => (
  <Text ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<View, ViewProps>(({ className, ...props }, ref) => {
  const variant = React.useContext(CardVariantContext);
  return (
    <TextClassContext.Provider value={cardTextVariants({ variant })}>
      <View ref={ref} className={cn('p-4 pt-0', className)} {...props} />
    </TextClassContext.Provider>
  );
});
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<View, ViewProps>(({ className, ...props }, ref) => (
  <View ref={ref} className={cn('flex flex-row items-center p-4 pt-0', className)} {...props} />
));
CardFooter.displayName = 'CardFooter';

export { cardTextVariants, cardVariants };
