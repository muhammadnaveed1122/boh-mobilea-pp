import * as React from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import { cn } from '@/lib/utils';
import { useThemeColor } from '@theme';

export interface TextareaProps extends TextInputProps {
  hasError?: boolean;
}

export const Textarea = React.forwardRef<TextInput, TextareaProps>(
  ({ className, placeholderClassName, hasError, multiline = true, numberOfLines = 4, ...props }, ref) => {
    const placeholder = useThemeColor('--muted-foreground');
    return (
      <TextInput
        ref={ref}
        multiline={multiline}
        numberOfLines={numberOfLines}
        textAlignVertical="top"
        className={cn(
          'min-h-24 rounded-lg border border-input bg-background px-3 py-3 text-base text-foreground',
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
Textarea.displayName = 'Textarea';
