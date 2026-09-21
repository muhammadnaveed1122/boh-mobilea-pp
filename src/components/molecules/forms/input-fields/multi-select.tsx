import { useFieldContext } from '../contexts';
import { FormBase, type FormBaseProps } from '../formbase';
import { MultiSelect } from '@/components/atoms/MultiSelect';

type FormMultiSelectProps = Omit<FormBaseProps, 'children' | 'controlFirst'> & {
  options: readonly { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
};

export function FormMultiSelect({
  label,
  required,
  options,
  placeholder = 'Select…',
  disabled,
}: Readonly<FormMultiSelectProps>) {
  const field = useFieldContext<string[]>();
  const hasError = field.state.meta.isTouched && field.state.meta.errors.length > 0;
  return (
    <FormBase label={label} required={required}>
      <MultiSelect
        value={field.state.value ?? []}
        onValueChange={(next) => {
          field.handleChange(next);
          field.handleBlur();
        }}
        options={options}
        placeholder={placeholder}
        disabled={disabled}
        hasError={hasError}
      />
    </FormBase>
  );
}
