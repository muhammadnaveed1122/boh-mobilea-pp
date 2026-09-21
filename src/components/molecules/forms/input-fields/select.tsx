import { useFieldContext } from '../contexts';
import { FormBase, type FormBaseProps } from '../formbase';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  type SelectOption,
} from '@/components/atoms/Select';

type FormSelectProps = Omit<FormBaseProps, 'children' | 'controlFirst'> & {
  options: readonly { value: string; label: string; group?: string }[];
  placeholder?: string;
  disabled?: boolean;
  portalHost?: string;
};

export function FormSelect({
  label,
  required,
  options,
  placeholder = 'Select…',
  disabled,
  portalHost,
}: Readonly<FormSelectProps>) {
  const field = useFieldContext<string | undefined>();
  const hasError = field.state.meta.isTouched && field.state.meta.errors.length > 0;

  const current: SelectOption = field.state.value
    ? options.find((o) => o.value === field.state.value)
    : undefined;

  return (
    <FormBase label={label} required={required}>
      <Select
        value={current}
        onValueChange={(opt) => {
          field.handleChange(opt?.value);
          field.handleBlur();
        }}
        disabled={disabled}
      >
        <SelectTrigger hasError={hasError}>
          <SelectValue
            className={current ? 'text-base text-foreground' : 'text-base text-muted-foreground'}
            placeholder={placeholder}
          />
        </SelectTrigger>
        <SelectContent portalHost={portalHost}>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} label={opt.label} group={opt.group} />
          ))}
        </SelectContent>
      </Select>
    </FormBase>
  );
}
