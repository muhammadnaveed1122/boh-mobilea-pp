import { ActivityIndicator, Pressable, View } from 'react-native';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  type SelectOption,
} from '@/components/atoms/Select';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';
import { useFieldContext } from '@/components/molecules/forms/contexts';
import { FormBase } from '@/components/molecules/forms/formbase';
import type { Opt } from '../types';

interface Props {
  label: string;
  required?: boolean;
  placeholder?: string;
  options: Opt[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  disabled?: boolean;
  /** Called in addition to field.handleChange when an option is picked (e.g. prefill). */
  onSelected?: (value: string | undefined) => void;
}

export function ApiSelectField({
  label,
  required,
  placeholder = 'Select…',
  options,
  isLoading,
  isError,
  onRetry,
  disabled,
  onSelected,
}: Readonly<Props>) {
  const field = useFieldContext<string | undefined>();
  const brand = useThemeColor('--brand');
  const hasError = field.state.meta.isTouched && field.state.meta.errors.length > 0;
  const current: SelectOption = field.state.value
    ? options.find((o) => o.value === field.state.value)
    : undefined;

  return (
    <FormBase label={label} required={required}>
      {isError ? (
        <View className="rounded-xl border border-destructive bg-card px-3 py-3">
          <Text className="text-xs text-destructive">Could not load options.</Text>
          <Pressable onPress={onRetry} hitSlop={8} className="mt-1">
            <Text className="text-xs font-semibold text-brand">Retry</Text>
          </Pressable>
        </View>
      ) : (
        <Select
          value={current}
          disabled={disabled || isLoading}
          onValueChange={(opt) => {
            field.handleChange(opt?.value);
            field.handleBlur();
            onSelected?.(opt?.value);
          }}
        >
          <SelectTrigger hasError={hasError}>
            {isLoading ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator size="small" color={brand} />
                <Text className="text-sm text-muted-foreground">Loading…</Text>
              </View>
            ) : (
              <SelectValue placeholder={options.length === 0 ? 'No options' : placeholder} />
            )}
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value} label={o.label} group={o.group} />
            ))}
          </SelectContent>
        </Select>
      )}
    </FormBase>
  );
}
