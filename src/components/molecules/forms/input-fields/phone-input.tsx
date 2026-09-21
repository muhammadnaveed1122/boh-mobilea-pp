import { useFieldContext } from '../contexts';
import { FormBase, type FormBaseProps } from '../formbase';
import { PhoneInput } from '@/components/atoms/PhoneInput';

type FormPhoneInputProps = Omit<FormBaseProps, 'children'> & {
  defaultCode?: string;
  placeholder?: string;
};

export function FormPhoneInput({
  label,
  required,
  defaultCode,
  placeholder,
}: Readonly<FormPhoneInputProps>) {
  const field = useFieldContext<string>();
  const hasError = field.state.meta.isTouched && field.state.meta.errors.length > 0;

  return (
    <FormBase label={label} required={required}>
      <PhoneInput
        value={field.state.value}
        defaultCode={defaultCode}
        onChangeFormattedText={field.handleChange}
        onBlur={field.handleBlur}
        hasError={hasError}
        placeholder={placeholder}
      />
    </FormBase>
  );
}
