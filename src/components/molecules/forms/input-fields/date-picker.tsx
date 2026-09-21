import { format } from 'date-fns';
import { useFieldContext } from '../contexts';
import { FormBase, type FormBaseProps } from '../formbase';
import { DatePicker } from '@/components/atoms/DatePicker';

type FormDatePickerProps = Omit<FormBaseProps, 'children' | 'controlFirst' | 'onPress'> & {
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  disabled?: boolean;
};

const ISO = 'yyyy-MM-dd';

/** Parse an ISO `yyyy-MM-dd` string to a local Date, or null if empty/invalid. */
function parse(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function FormDatePicker({
  label,
  required,
  placeholder,
  minimumDate,
  maximumDate,
  disabled,
}: Readonly<FormDatePickerProps>) {
  const field = useFieldContext<string>();
  const hasError = field.state.meta.isTouched && field.state.meta.errors.length > 0;

  return (
    <FormBase label={label} required={required}>
      <DatePicker
        value={parse(field.state.value)}
        onChange={(date) => field.handleChange(format(date, ISO))}
        placeholder={placeholder}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        disabled={disabled}
        hasError={hasError}
      />
    </FormBase>
  );
}
