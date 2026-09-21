import { View, TextInputProps } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { Input } from '@/components/atoms/Input';

interface Props extends TextInputProps {
  label: string;
  error?: string;
}

export function FormField({ label, error, ...inputProps }: Readonly<Props>) {
  return (
    <View className="gap-1">
      <Text variant="label" className="mb-0.5">{label}</Text>
      <Input hasError={!!error} {...inputProps} />
      {error ? <Text variant="error" className="mt-0.5">{error}</Text> : null}
    </View>
  );
}
