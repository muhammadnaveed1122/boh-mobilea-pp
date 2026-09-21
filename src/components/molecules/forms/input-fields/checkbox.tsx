import { useFieldContext } from '../contexts';
import { FormBase, type FormBaseProps } from '../formbase';
import { Checkbox } from '@/components/atoms/Checkbox';

type FormCheckboxProps = Omit<FormBaseProps, 'children' | 'controlFirst' | 'onPress'>;

export function FormCheckbox({ label, required }: Readonly<FormCheckboxProps>) {
  const field = useFieldContext<boolean>();

  return (
    <FormBase
      label={label}
      required={required}
      controlFirst
      onPress={() => field.handleChange(!field.state.value)}
    >
      <Checkbox checked={field.state.value} onCheckedChange={(next) => field.handleChange(next)} />
    </FormBase>
  );
}
