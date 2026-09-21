/**
 * FieldSelect — the single Select wrapper shared by every property dropdown
 * and by the shared-section selects on the Lead Detail screen.
 *
 * Collapses the two pre-existing copies of this widget (`SelectField` in
 * `RequirementField.tsx` and `EditableSelect` in `LeadRequirementsCard.tsx`)
 * into one component:
 *
 * - `readOnly` → renders a static gray tile with the resolved label (matches
 *   the lead-detail read-only visual).
 * - otherwise → renders the interactive `@rn-primitives/select`-backed atom.
 *
 * Stateless and presentational: no cascade decisions, no data fetching. The
 * concrete `*Select` components bind their option set + default
 * label/placeholder and delegate here.
 */

import { View } from 'react-native';

import { Icon } from '@/components/atoms/Icon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/Select';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import { useThemeColor } from '@theme';

import type { BaseDropdownProps, DropdownOption } from './types';

export interface FieldSelectProps extends BaseDropdownProps {
  readonly label: string;
  readonly placeholder: string;
  readonly options: readonly DropdownOption[];
}

interface ReadOnlyTileProps {
  readonly text: string;
  readonly placeholder: string;
}

function ReadOnlyTile({ text, placeholder }: ReadOnlyTileProps) {
  const mutedFg = useThemeColor('--muted-foreground');
  const isEmpty = text.trim().length === 0;
  return (
    <View
      accessibilityRole="text"
      className="h-12 flex-row items-center justify-between rounded-xl border border-input bg-muted/40 px-4 opacity-90"
    >
      <Text
        className={cn(
          'text-base',
          isEmpty ? 'text-muted-foreground' : 'font-medium text-foreground',
        )}
      >
        {isEmpty ? placeholder : text}
      </Text>
      <Icon name="ChevronDown" size={18} color={mutedFg} />
    </View>
  );
}

export function FieldSelect({
  label,
  placeholder,
  options,
  value,
  onChange,
  disabled,
  readOnly,
  error,
  hint,
  portalHost,
}: FieldSelectProps) {
  const selected = value ? options.find((o) => o.value === value) : undefined;
  const hasError = Boolean(error);

  return (
    <View className="gap-1">
      <Text variant="label" className="mb-0.5">
        {label}
      </Text>

      {readOnly ? (
        <ReadOnlyTile text={selected?.label ?? ''} placeholder={placeholder} />
      ) : (
        <Select value={selected} onValueChange={(opt) => onChange(opt?.value)} disabled={disabled}>
          <SelectTrigger hasError={hasError}>
            <SelectValue
              className={cn('text-base', selected ? 'text-foreground' : 'text-muted-foreground')}
              placeholder={placeholder}
            />
          </SelectTrigger>
          <SelectContent portalHost={portalHost}>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} label={opt.label} />
            ))}
          </SelectContent>
        </Select>
      )}

      {error ? (
        <Text variant="error" className="mt-0.5">
          {error}
        </Text>
      ) : null}
      {!error && hint ? <Text className="mt-0.5 text-xs text-muted-foreground">{hint}</Text> : null}
    </View>
  );
}
