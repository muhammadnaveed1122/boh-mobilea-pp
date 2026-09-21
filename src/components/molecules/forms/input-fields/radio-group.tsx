import { Pressable, View } from 'react-native';
import { useFieldContext } from '../contexts';
import { FormBase, type FormBaseProps } from '../formbase';
import { Text } from '@/components/atoms/Text';
import { RadioGroup, RadioGroupItem } from '@/components/atoms/RadioGroup';

type RadioOption = {
  label: string;
  value: string;
};

type FormRadioGroupProps = Omit<FormBaseProps, 'children' | 'controlFirst'> & {
  options: RadioOption[];
};

export function FormRadioGroup({ label, required, options }: Readonly<FormRadioGroupProps>) {
  const field = useFieldContext<string>();

  return (
    <FormBase label={label} required={required}>
      <RadioGroup value={field.state.value} onValueChange={field.handleChange}>
        {options.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => field.handleChange(option.value)}
            className="flex-row items-center gap-3"
          >
            <RadioGroupItem value={option.value} aria-labelledby={`radio-${option.value}`} />
            <View>
              <Text variant="body" nativeID={`radio-${option.value}`}>{option.label}</Text>
            </View>
          </Pressable>
        ))}
      </RadioGroup>
    </FormBase>
  );
}
