import * as React from 'react';
import { Text as RNText, type TextProps } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const TextClassContext = React.createContext<string | undefined>(undefined);

const textVariants = cva('text-foreground', {
  variants: {
    variant: {
      body: 'text-base',
      small: 'text-sm',
      large: 'text-lg',
      muted: 'text-sm text-muted-foreground',
      label: 'text-sm font-medium leading-none',
      title: 'text-3xl font-bold tracking-tight',
      heading: 'text-2xl font-semibold tracking-tight',
      subheading: 'text-xl font-semibold tracking-tight',
      lead: 'text-xl text-muted-foreground',
      error: 'text-xs text-destructive',
    },
  },
  defaultVariants: {
    variant: 'body',
  },
});

export type TextVariants = VariantProps<typeof textVariants>;

export interface TextOwnProps extends TextProps, TextVariants {
  asChild?: boolean;
}

export const Text = React.forwardRef<RNText, TextOwnProps>(
  ({ className, variant, ...props }, ref) => {
    const inheritedClass = React.useContext(TextClassContext);
    return (
      <RNText
        ref={ref}
        className={cn(textVariants({ variant }), inheritedClass, className)}
        {...props}
      />
    );
  },
);
Text.displayName = 'Text';
