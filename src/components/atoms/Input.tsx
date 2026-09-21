import * as React from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import { cn } from '@/lib/utils';
import { useThemeColor } from '@theme';

export interface InputProps extends TextInputProps {
  hasError?: boolean;
}

export const Input = React.forwardRef<TextInput, InputProps>(
  ({ className, placeholderClassName, hasError, ...props }, ref) => {
    const placeholder = useThemeColor('--muted-foreground');
    return (
      <TextInput
        ref={ref}
        // Pin single-line on the New Architecture — without this a long value
        // wraps onto multiple lines and spills past the fixed-height field.
        multiline={false}
        numberOfLines={1}
        className={cn(
          // text-[14px], not text-base: a lineHeight on a single-line input adds an
          // NSParagraphStyle, and a blurred UITextField word-wraps paragraph-styled
          // text past the field bounds instead of truncating it.
          'h-11 w-full rounded-lg border border-input bg-background px-3 text-[14px] text-foreground',
          'web:flex web:py-2 web:ring-offset-background web:focus:outline-none web:focus:ring-2 web:focus:ring-ring',
          props.editable === false && 'opacity-50',
          hasError && 'border-destructive',
          className,
        )}
        placeholderClassName={cn('text-muted-foreground', placeholderClassName)}
        placeholderTextColor={placeholder}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';
