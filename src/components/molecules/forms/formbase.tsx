import { Pressable, View } from 'react-native';
import type { ReactNode } from 'react';
import { useFieldContext } from './contexts';
import { Text } from '@/components/atoms/Text';

export type FormBaseProps = {
  label?: string;
  required?: boolean;
  children: ReactNode;
  controlFirst?: boolean;
  onPress?: () => void;
};

function errorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

export function FormBase({
  label,
  required,
  children,
  controlFirst,
  onPress,
}: Readonly<FormBaseProps>) {
  const field = useFieldContext();
  const errors = field.state.meta.isTouched ? field.state.meta.errors : [];
  const firstError = errors.length > 0 ? errorMessage(errors[0]) : null;

  const labelElem =
    label !== undefined && label.length > 0 ? (
      <Text variant="label">
        {label}
        {required ? (
          <Text variant="label" className="text-destructive">
            {' '}
            *
          </Text>
        ) : null}
      </Text>
    ) : null;

  const errorElem = firstError === null ? null : <Text variant="error">{firstError}</Text>;

  if (controlFirst) {
    const Row = onPress ? Pressable : View;
    return (
      <Row onPress={onPress} className="flex-row items-center gap-3">
        {children}
        <View className="shrink gap-0.5">
          {labelElem}
          {errorElem}
        </View>
      </Row>
    );
  }

  return (
    <View className="gap-1">
      {labelElem}
      {children}
      {errorElem}
    </View>
  );
}
