import { useFieldContext } from '../contexts';
import { FormBase, type FormBaseProps } from '../formbase';
import { Textarea } from '@/components/atoms/Textarea';

type FormTextareaProps = Omit<FormBaseProps, 'children' | 'controlFirst'> & {
  placeholder?: string;
  numberOfLines?: number;
  maxLength?: number;
};

export function FormTextarea({
  label,
  required,
  placeholder,
  numberOfLines = 4,
  maxLength,
}: Readonly<FormTextareaProps>) {
  const field = useFieldContext<string>();
  const hasError =
    field.state.meta.isTouched && field.state.meta.errors.length > 0;

  return (
    <FormBase label={label} required={required}>
      <Textarea
        value={field.state.value}
        onChangeText={field.handleChange}
        onBlur={field.handleBlur}
        placeholder={placeholder}
        numberOfLines={numberOfLines}
        maxLength={maxLength}
        hasError={hasError}
      />
    </FormBase>
  );
}
