/**
 * PropertyTaxonomyCard — conditional dynamic-fields card for the Lead Detail
 * screen.
 *
 * Renders ONLY the purpose-specific taxonomy fields. The shared fields are
 * owned by `LeadRequirementsCard`. Visibility is delegated to the pure
 * `visibleFields(purpose, values)` selector; per-field rendering is delegated
 * to `<RequirementField />`.
 *
 * Cascade resets are NOT applied here — the parent form context routes
 * `onChange` through the pure engine (`form/apply-dependencies.ts`) before
 * persisting the new value.
 *
 * Web reference: `boh-lead-magnet/src/features/leads/components/sections/QualificationSection.tsx:149`
 */

import { View } from 'react-native';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/molecules/Card';
import { SHARED_FIELDS } from '@/features/leads/form/field-registry';
import type { FieldKey, FormValues } from '@/features/leads/form/form-keys';
import { visibleFields } from '@/features/leads/form/visible-fields';

import { RequirementField } from './RequirementField';

export type PropertyTaxonomyCardProps = Readonly<{
  /** Purpose / interestType value (e.g. `'find_a_property_to_buy'`). */
  purpose?: string;
  /** Current form values for the requirement subset. */
  values: FormValues;
  /**
   * Field-change callback. Parent applies cascade resets via the pure engine
   * (`form/apply-dependencies.ts`) before persisting the new value.
   */
  onChange: (key: FieldKey, value: unknown) => void;
  /** When false, all fields render as disabled (read-only). */
  isEditing: boolean;
  /** Per-field error map keyed by `FieldKey`. */
  errors?: Record<string, string | undefined>;
  /** Optional portal host for select dropdowns (when mounted inside a modal). */
  portalHost?: string;
}>;

export function PropertyTaxonomyCard({
  purpose,
  values,
  onChange,
  isEditing,
  errors,
  portalHost,
}: PropertyTaxonomyCardProps) {
  const all = visibleFields(purpose, values);
  const taxonomy = all.filter((k) => !(SHARED_FIELDS as readonly string[]).includes(k));
  if (!purpose || taxonomy.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl text-brand">Property Taxonomy</CardTitle>
      </CardHeader>
      <CardContent>
        <View className="gap-4">
          {taxonomy.map((f) => (
            <RequirementField
              key={f}
              field={f}
              values={values}
              onChange={onChange}
              isEditing={isEditing}
              errors={errors}
              portalHost={portalHost}
            />
          ))}
        </View>
      </CardContent>
    </Card>
  );
}
