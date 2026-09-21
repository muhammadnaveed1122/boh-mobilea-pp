/**
 * LeadRequirementsCard — shared (top) section of the Lead Detail form:
 * Persona, Purpose, City, Area / Neighborhood, Notes.
 *
 * Persona/Purpose are now driven by the shared registry/engine via
 * `<RequirementField />`; the persona→purpose cascade is owned by the engine
 * (`resetOnChange`), so no inline reset logic lives here. City and Area stay
 * API-fed (locations API, matching web) and render through the app-wide
 * `<DependentSelect />` with an explicit `options` override and the
 * `withSelected` seed trick preserved.
 *
 * Property-taxonomy fields (use/type/unit/price/etc.) are owned by the
 * sibling `PropertyTaxonomyCard` — do not add those fields here.
 */

import { useMemo } from 'react';
import { View } from 'react-native';

import { DependentSelect, type DropdownOption, type DropdownSpec } from '@/components/dropdowns';
import { Text } from '@/components/atoms/Text';
import { Textarea } from '@/components/atoms/Textarea';
import { cn } from '@/lib/utils';
import type { FieldKey, FormValues } from '@/features/leads/form/form-keys';
import type { LeadDetail } from '@/features/leads/models/lead-detail';
import type { LocationItem } from '@/features/leads/models/location';

import { useNeighbourhoods } from '../../hooks/use-neighbourhoods';
import { useStates } from '../../hooks/use-states';
import { RequirementField } from './RequirementField';

export type LeadRequirementsCardProps = Readonly<{
  lead: LeadDetail;
  isEditing: boolean;
  canUpdate: boolean;
  values: FormValues;
  onChange: (key: FieldKey, value: unknown) => void;
  errors?: Record<string, string | undefined>;
}>;

const NOTES_PLACEHOLDER = 'Enter any additional qualification notes here...';

// City / Area are API-fed (locations API): both specs are static — options
// arrive via the `options` override and Area's context-dependent placeholder
// is passed through `DependentSelect`'s `placeholder` prop.
const CITY_SPEC: DropdownSpec = {
  id: 'state',
  label: 'City',
  placeholder: 'Select City',
  options: [],
};
const AREA_SPEC: DropdownSpec = {
  id: 'neighbourhood',
  label: 'Area / Neighborhood',
  placeholder: 'Select Area / Neighborhood',
  options: [],
};

function toOptions(items: readonly LocationItem[]): DropdownOption[] {
  return items.map((i) => ({ value: i.id, label: i.name }));
}

/**
 * Ensure the currently-saved value is always selectable/visible even before
 * (or if) the fetched list does not include it — seeded from the `*Name`
 * the lead payload already carries.
 */
function withSelected(
  options: DropdownOption[],
  id: string | undefined,
  name: string | undefined,
): DropdownOption[] {
  if (!id || options.some((o) => o.value === id)) {
    return options;
  }
  return [{ value: id, label: name ?? id }, ...options];
}

// ============================================
// Notes field (Textarea editable / soft-tile read-only)
// ============================================

interface NotesFieldProps {
  value: string;
  isInteractive: boolean;
  onChange: (next: string) => void;
  errorMessage?: string;
}

function NotesField({ value, isInteractive, onChange, errorMessage }: Readonly<NotesFieldProps>) {
  if (isInteractive) {
    return (
      <View>
        <Text className="mb-1.5 text-sm font-medium text-foreground">Notes</Text>
        <Textarea
          value={value}
          onChangeText={onChange}
          placeholder={NOTES_PLACEHOLDER}
          hasError={Boolean(errorMessage)}
        />
        {errorMessage ? (
          <Text className="mt-1 text-xs text-destructive">{errorMessage}</Text>
        ) : null}
      </View>
    );
  }

  const isEmpty = value.trim().length === 0;
  return (
    <View>
      <Text className="mb-1.5 text-sm font-medium text-foreground">Notes</Text>
      <View className="rounded-xl border border-input bg-muted/40 px-4 py-3 opacity-90">
        <Text className={cn('text-base', isEmpty ? 'text-muted-foreground' : 'text-foreground')}>
          {isEmpty ? NOTES_PLACEHOLDER : value}
        </Text>
      </View>
    </View>
  );
}

// ============================================
// Card
// ============================================

export function LeadRequirementsCard({
  lead,
  isEditing,
  canUpdate,
  values,
  onChange,
  errors,
}: LeadRequirementsCardProps) {
  const isInteractive = isEditing && canUpdate;
  const readOnly = !isInteractive;

  // Only hit the locations API in edit mode — read-only resolves the label
  // from the `*Name` the lead payload already carries (via `withSelected`).
  const statesQuery = useStates({ enabled: isInteractive });
  const neighbourhoodsQuery = useNeighbourhoods(values.stateId, { enabled: isInteractive });

  const cityOptions = useMemo(
    () => withSelected(toOptions(statesQuery.data ?? []), values.stateId, values.stateName),
    [statesQuery.data, values.stateId, values.stateName],
  );
  const areaOptions = useMemo(
    () =>
      withSelected(
        toOptions(neighbourhoodsQuery.data ?? []),
        values.neighbourhoodId,
        values.neighbourhoodName,
      ),
    [neighbourhoodsQuery.data, values.neighbourhoodId, values.neighbourhoodName],
  );

  const areaPlaceholder = values.stateId ? 'Select Area / Neighborhood' : 'Select City first';

  return (
    <View
      accessibilityLabel={`Lead requirements for ${lead.name}`}
      className="overflow-hidden rounded-2xl border border-border bg-card p-4"
    >
      <View className="mb-4">
        <Text className="text-lg font-semibold text-brand">Lead Requirements</Text>
        <Text className="mt-1 text-sm text-muted-foreground">
          One consistent intake surface for all purposes.
        </Text>
      </View>

      <View className="gap-4">
        <RequirementField
          field="persona"
          values={values}
          onChange={onChange}
          isEditing={isInteractive}
          errors={errors}
        />

        <RequirementField
          field="purpose"
          values={values}
          onChange={onChange}
          isEditing={isInteractive}
          errors={errors}
        />

        <DependentSelect
          spec={CITY_SPEC}
          ctx={undefined}
          options={cityOptions}
          value={values.stateId}
          onChange={(v) => onChange('stateId', v)}
          readOnly={readOnly}
          error={errors?.stateId}
        />

        <DependentSelect
          spec={AREA_SPEC}
          ctx={undefined}
          options={areaOptions}
          placeholder={areaPlaceholder}
          value={values.neighbourhoodId}
          onChange={(v) => onChange('neighbourhoodId', v)}
          disabled={!values.stateId}
          readOnly={readOnly}
          error={errors?.neighbourhoodId}
        />

        <NotesField
          value={values.notes ?? ''}
          isInteractive={isInteractive}
          onChange={(next) => onChange('notes', next)}
          errorMessage={errors?.notes}
        />
      </View>
    </View>
  );
}
