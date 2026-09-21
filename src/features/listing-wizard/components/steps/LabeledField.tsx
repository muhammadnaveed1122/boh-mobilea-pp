import { View } from 'react-native';
import { format } from 'date-fns';

import { DatePicker } from '@/components/atoms/DatePicker';
import { Input } from '@/components/atoms/Input';
import { Label } from '@/components/atoms/Label';
import { Text } from '@/components/atoms/Text';
import { Textarea } from '@/components/atoms/Textarea';

function FieldLabel({ label, required }: Readonly<{ label: string; required: boolean }>) {
  return (
    <View className="flex-row">
      <Label>{label}</Label>
      {required ? <Text className="text-sm font-medium text-destructive"> *</Text> : null}
    </View>
  );
}

/** Label + single-line input. */
export function LabeledInput({
  label,
  required = false,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: Readonly<{
  label: string;
  required?: boolean;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'url' | 'numeric';
}>) {
  return (
    <View className="gap-1.5">
      <FieldLabel label={label} required={required} />
      <Input
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'url' ? 'none' : 'sentences'}
      />
    </View>
  );
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Label + date picker (stores a `yyyy-MM-dd` string). */
export function LabeledDatePicker({
  label,
  required = false,
  value,
  onChangeText,
  placeholder,
}: Readonly<{
  label: string;
  required?: boolean;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}>) {
  return (
    <View className="gap-1.5">
      <FieldLabel label={label} required={required} />
      <DatePicker
        value={parseDate(value)}
        onChange={(d) => onChangeText(format(d, 'yyyy-MM-dd'))}
        placeholder={placeholder}
      />
    </View>
  );
}

/** Label + multi-line textarea. */
export function LabeledTextarea({
  label,
  required = false,
  value,
  onChangeText,
  placeholder,
  numberOfLines = 4,
}: Readonly<{
  label: string;
  required?: boolean;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  numberOfLines?: number;
}>) {
  return (
    <View className="gap-1.5">
      <FieldLabel label={label} required={required} />
      <Textarea
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        numberOfLines={numberOfLines}
      />
    </View>
  );
}
