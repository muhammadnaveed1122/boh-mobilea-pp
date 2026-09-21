import { type ReactNode } from 'react';
import { View } from 'react-native';
import { useFieldContext } from '../contexts';
import { FormBase, type FormBaseProps } from '../formbase';
import { Input } from '@/components/atoms/Input';

type FormInputProps = Omit<FormBaseProps, 'children' | 'controlFirst'> & {
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: string;
  leftIcon?: ReactNode;
  rightElement?: ReactNode;
};

export function FormInput({
  label,
  required,
  placeholder,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoComplete,
  leftIcon,
  rightElement,
}: Readonly<FormInputProps>) {
  const field = useFieldContext<string>();
  const hasError = field.state.meta.isTouched && field.state.meta.errors.length > 0;

  const input = (
    <Input
      value={field.state.value}
      onChangeText={field.handleChange}
      onBlur={field.handleBlur}
      placeholder={placeholder}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      autoComplete={autoComplete as any}
      hasError={hasError}
      className={leftIcon || rightElement ? 'flex-1 border-0 bg-transparent' : undefined}
    />
  );

  const content =
    leftIcon || rightElement ? (
      <View
        className={`flex-row items-center rounded-lg border bg-background px-3 ${hasError ? 'border-destructive' : 'border-input'}`}
      >
        {leftIcon}
        {input}
        {rightElement}
      </View>
    ) : (
      input
    );

  return (
    <FormBase label={label} required={required}>
      {content}
    </FormBase>
  );
}
