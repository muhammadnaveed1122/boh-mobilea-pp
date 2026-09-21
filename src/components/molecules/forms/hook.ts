import { createFormHook } from '@tanstack/react-form';
import { fieldContext, formContext } from './contexts';
import { FormInput } from './input-fields/input';
import { FormTextarea } from './input-fields/textarea';
import { FormCheckbox } from './input-fields/checkbox';
import { FormRadioGroup } from './input-fields/radio-group';
import { FormPhoneInput } from './input-fields/phone-input';
import { FormImagePicker } from './input-fields/image-picker';
import { FormSelect } from './input-fields/select';
import { FormDatePicker } from './input-fields/date-picker';
import { FormMultiSelect } from './input-fields/multi-select';

const { useAppForm } = createFormHook({
  fieldComponents: {
    Input: FormInput,
    Textarea: FormTextarea,
    Checkbox: FormCheckbox,
    RadioGroup: FormRadioGroup,
    PhoneInput: FormPhoneInput,
    ImagePicker: FormImagePicker,
    Select: FormSelect,
    DatePicker: FormDatePicker,
    MultiSelect: FormMultiSelect,
  },
  formComponents: {},
  fieldContext,
  formContext,
});

export { useAppForm };
export { useFieldContext, useFormContext } from './contexts';
