/**
 * RequirementField — kind-driven field renderer for the Property Taxonomy
 * card.
 *
 * Every field is described once in `FIELD_REGISTRY`. This component reads the
 * field's `kind` and renders the matching primitive: selects are delegated to
 * the app-wide `DependentSelect` (fed a catalog spec + the ctx the registry
 * declares), and number / currency-pair / text / textarea fields keep their
 * local renderers. Stateless: values come from the parent form context;
 * cascade resets are applied by the parent engine.
 */

import { View } from 'react-native';

import {
  DependentSelect,
  dropdownCatalog,
  type DropdownCatalog,
  type DropdownSpec,
} from '@/components/dropdowns';
import { Input } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Text';
import { Textarea } from '@/components/atoms/Textarea';
import { FIELD_REGISTRY, resolveFieldOptions } from '@/features/leads/form/field-registry';
import type { FieldKey, FormValues, RequirementFieldKey } from '@/features/leads/form/form-keys';

export interface RequirementFieldErrors {
  readonly [key: string]: string | undefined;
}

export interface RequirementFieldProps {
  readonly field: FieldKey;
  readonly values: FormValues;
  readonly onChange: (key: FieldKey, value: unknown) => void;
  readonly isEditing: boolean;
  readonly errors?: Record<string, string | undefined>;
  readonly portalHost?: string;
}

const LABELS: Readonly<Record<string, string>> = {
  bedrooms: 'Bedrooms',
  bathrooms: 'Bathrooms',
  projectBuilding: 'Project / Building',
  askingPriceMin: 'Asking Price (Min — Max)',
  askingRentMin: 'Asking Rent (Min — Max)',
  budgetMin: 'Budget (Min — Max)',
  dealBreaker: 'Deal Breaker',
  niceToHaves: 'Nice to Haves',
  notes: 'Notes',
};

// ============================================
// Internal helpers
// ============================================

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readNumberString(value: unknown): string {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return String(value);
  }
  if (typeof value === 'string') {
    return value;
  }
  return '';
}

function parseNumberOrUndefined(raw: string): number | undefined {
  if (raw === '') {
    return undefined;
  }
  const n = Number(raw);
  return Number.isNaN(n) ? undefined : n;
}

// ============================================
// Non-select renderers (unchanged)
// ============================================

interface NumberFieldProps {
  readonly label: string;
  readonly value: string;
  readonly placeholder?: string;
  readonly disabled: boolean;
  readonly error?: string;
  readonly hint?: string;
  readonly onChangeNumber: (value: number | undefined) => void;
  readonly readOnly?: boolean;
}

function NumberField({
  label,
  value,
  placeholder,
  disabled,
  error,
  hint,
  onChangeNumber,
  readOnly,
}: NumberFieldProps) {
  const hasError = Boolean(error);
  return (
    <View className="gap-1">
      <Text variant="label" className="mb-0.5">
        {label}
      </Text>
      <Input
        value={value}
        onChangeText={(raw) => onChangeNumber(parseNumberOrUndefined(raw))}
        placeholder={placeholder}
        keyboardType="numeric"
        editable={!disabled && !readOnly}
        hasError={hasError}
      />
      {error ? (
        <Text variant="error" className="mt-0.5">
          {error}
        </Text>
      ) : null}
      {!error && hint ? <Text className="mt-0.5 text-xs text-muted-foreground">{hint}</Text> : null}
    </View>
  );
}

interface TextFieldProps {
  readonly label: string;
  readonly value: string;
  readonly placeholder?: string;
  readonly disabled: boolean;
  readonly error?: string;
  readonly onChangeText: (value: string) => void;
}

function TextField({ label, value, placeholder, disabled, error, onChangeText }: TextFieldProps) {
  const hasError = Boolean(error);
  return (
    <View className="gap-1">
      <Text variant="label" className="mb-0.5">
        {label}
      </Text>
      <Input
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        editable={!disabled}
        hasError={hasError}
      />
      {error ? (
        <Text variant="error" className="mt-0.5">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

interface TextareaFieldProps {
  readonly label: string;
  readonly value: string;
  readonly placeholder?: string;
  readonly disabled: boolean;
  readonly error?: string;
  readonly onChangeText: (value: string) => void;
}

function TextareaField({
  label,
  value,
  placeholder,
  disabled,
  error,
  onChangeText,
}: TextareaFieldProps) {
  const hasError = Boolean(error);
  return (
    <View className="gap-1">
      <Text variant="label" className="mb-0.5">
        {label}
      </Text>
      <Textarea
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        editable={!disabled}
        hasError={hasError}
      />
      {error ? (
        <Text variant="error" className="mt-0.5">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

interface CurrencyPairFieldProps {
  readonly label: string;
  readonly minValue: string;
  readonly maxValue: string;
  readonly disabled: boolean;
  readonly errorMin?: string;
  readonly errorMax?: string;
  readonly onMinChange: (value: number | undefined) => void;
  readonly onMaxChange: (value: number | undefined) => void;
}

function CurrencyPairField({
  label,
  minValue,
  maxValue,
  disabled,
  errorMin,
  errorMax,
  onMinChange,
  onMaxChange,
}: CurrencyPairFieldProps) {
  const minNum = parseNumberOrUndefined(minValue);
  const maxNum = parseNumberOrUndefined(maxValue);
  const rangeError =
    !errorMin && !errorMax && minNum !== undefined && maxNum !== undefined && maxNum < minNum
      ? 'Max must be greater than or equal to Min'
      : undefined;
  return (
    <View className="gap-1">
      <Text variant="label" className="mb-0.5">
        {label}
      </Text>
      <View className="flex-row items-start gap-2">
        <View className="flex-1">
          <Input
            value={minValue}
            onChangeText={(raw) => onMinChange(parseNumberOrUndefined(raw))}
            placeholder="Min"
            keyboardType="numeric"
            editable={!disabled}
            hasError={Boolean(errorMin) || Boolean(rangeError)}
          />
        </View>
        <Text className="mt-3 text-muted-foreground">—</Text>
        <View className="flex-1">
          <Input
            value={maxValue}
            onChangeText={(raw) => onMaxChange(parseNumberOrUndefined(raw))}
            placeholder="Max"
            keyboardType="numeric"
            editable={!disabled}
            hasError={Boolean(errorMax) || Boolean(rangeError)}
          />
        </View>
      </View>
      {errorMin || errorMax || rangeError ? (
        <Text variant="error" className="mt-0.5">
          {errorMin ?? errorMax ?? rangeError}
        </Text>
      ) : null}
    </View>
  );
}

// ============================================
// Dispatcher — registry `kind` drives the renderer
// ============================================

export function RequirementField({
  field,
  values,
  onChange,
  isEditing,
  errors,
  portalHost,
}: RequirementFieldProps) {
  const def = FIELD_REGISTRY[field as RequirementFieldKey];
  const disabled = !isEditing;
  const error = errors?.[field];

  if (def.kind === 'select') {
    // Options are resolved by the single registry boundary; the catalog spec
    // is used only for this field's label/placeholder. apiFed selects
    // (City/Area) are rendered directly by LeadRequirementsCard via
    // DependentSelect, never through here — so a catalog spec always exists.
    const spec = dropdownCatalog[
      def.specId as keyof DropdownCatalog
    ] as unknown as DropdownSpec<unknown>;
    const ctx = def.ctxFrom ? def.ctxFrom(values) : undefined;
    const options = resolveFieldOptions(def, values);
    return (
      <DependentSelect
        spec={spec}
        ctx={ctx}
        options={options}
        value={values[field] as string | undefined}
        onChange={(v) => onChange(field, v)}
        disabled={disabled}
        readOnly={disabled}
        error={error}
        portalHost={portalHost}
      />
    );
  }

  if (def.kind === 'number') {
    const isDerived = def.derived !== undefined;
    const derived = def.derived?.(values);
    let numberValue: string;
    if (isDerived) {
      numberValue = derived === undefined ? '' : String(derived);
    } else {
      numberValue = readNumberString(values[field]);
    }
    return (
      <NumberField
        label={LABELS[field] ?? field}
        value={numberValue}
        placeholder={LABELS[field] ?? field}
        disabled={disabled}
        readOnly={def.readOnly === true}
        hint={isDerived ? 'Derived from Unit Type' : undefined}
        error={error}
        onChangeNumber={(v) => onChange(field, v)}
      />
    );
  }

  if (def.kind === 'currencyPair') {
    const maxKey = def.pairMax as FieldKey;
    return (
      <CurrencyPairField
        label={LABELS[field] ?? field}
        minValue={readNumberString(values[field])}
        maxValue={readNumberString(values[maxKey])}
        disabled={disabled}
        errorMin={errors?.[field]}
        errorMax={errors?.[maxKey]}
        onMinChange={(v) => onChange(field, v)}
        onMaxChange={(v) => onChange(maxKey, v)}
      />
    );
  }

  if (def.kind === 'text') {
    return (
      <TextField
        label={LABELS[field] ?? field}
        value={readString(values[field])}
        disabled={disabled}
        error={error}
        onChangeText={(v) => onChange(field, v)}
      />
    );
  }

  return (
    <TextareaField
      label={LABELS[field] ?? field}
      value={readString(values[field])}
      disabled={disabled}
      error={error}
      onChangeText={(v) => onChange(field, v)}
    />
  );
}
