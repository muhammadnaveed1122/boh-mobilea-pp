import { useEffect } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/atoms/Text';
import { FURNISHING_OPTIONS, VIEW_OPTIONS } from '../../constants';
import type { InformationForm } from '../../forms/information.form';
import {
  useOpportunityDetailQuery,
  useOwnerProperties,
  usePropertyTypes,
} from '../../hooks/use-wizard-options';
import { ApiSelectField } from '../ApiSelectField';
import { WizardCard } from '../WizardCard';
import { SegmentedToggle } from './SegmentedToggle';

export function SecondaryPropertySection({
  form,
  editMode = false,
}: Readonly<{ form: InformationForm; editMode?: boolean }>) {
  return (
    <WizardCard icon="Building2" title="Property" description="Property details and configuration.">
      {/* Edit mode edits the linked property directly — no new/existing switch or
          auto-prefill (fields are already seeded from the server). */}
      {editMode ? null : (
        <>
          <PropertySourceToggle form={form} />
          <PropertyPrefill form={form} />
        </>
      )}
      <PropertyFields form={form} />
    </WizardCard>
  );
}

function PropertySourceToggle({ form }: Readonly<{ form: InformationForm }>) {
  return (
    <form.Subscribe
      selector={(s) => ({ mode: s.values.propertySourceMode, ownerId: s.values.existingOwnerId })}
    >
      {({ mode, ownerId }) => (
        <PropertySourceToggleInner form={form} mode={mode} ownerId={ownerId} />
      )}
    </form.Subscribe>
  );
}

function PropertySourceToggleInner({
  form,
  mode,
  ownerId,
}: Readonly<{ form: InformationForm; mode: string; ownerId: string }>) {
  const properties = useOwnerProperties(ownerId || undefined);

  return (
    <>
      <SegmentedToggle
        value={mode}
        onChange={(v) => {
          form.setFieldValue('propertySourceMode', v as 'new' | 'existing');
          if (v === 'new') form.setFieldValue('existingPropertyId', '');
        }}
        left={{ value: 'new', label: 'Add new property' }}
        right={{ value: 'existing', label: 'Select existing property' }}
      />
      {mode === 'existing' ? (
        <form.AppField name="existingPropertyId">
          {() => (
            <ApiSelectField
              label="Existing Property"
              placeholder="Search property"
              options={properties.data}
              isLoading={properties.isLoading}
              isError={properties.isError}
              onRetry={() => properties.refetch()}
            />
          )}
        </form.AppField>
      ) : null}
    </>
  );
}

/** Bridges the Subscribe → stable component boundary for property prefill. */
function PropertyPrefill({ form }: Readonly<{ form: InformationForm }>) {
  return (
    <form.Subscribe selector={(s) => s.values.existingPropertyId}>
      {(propertyId) => <PropertyPrefillInner form={form} propertyId={propertyId} />}
    </form.Subscribe>
  );
}

function PropertyPrefillInner({
  form,
  propertyId,
}: Readonly<{ form: InformationForm; propertyId: string }>) {
  const { data } = useOpportunityDetailQuery(propertyId || undefined);

  useEffect(() => {
    if (!data) return;
    form.setFieldValue('bedrooms', data.bedrooms == null ? '' : String(data.bedrooms));
    form.setFieldValue('bathrooms', data.bathrooms == null ? '' : String(data.bathrooms));
    form.setFieldValue('builtUpArea', data.builtUpArea ?? '');
    form.setFieldValue('unitType', data.unitType ?? '');
    form.setFieldValue('furnishing', data.furnishing ?? '');
    form.setFieldValue('view', data.view ?? '');
    form.setFieldValue('projectBuilding', data.projectBuilding ?? '');
    form.setFieldValue('towerBlock', data.towerBlock ?? '');
    form.setFieldValue('unitNumber', data.unitNumber ?? '');
    form.setFieldValue('floor', data.floor ?? '');
    form.setFieldValue('projectAddress', data.buildingProjectAddress ?? '');
    form.setFieldValue('askingPrice', data.askingPrice ?? '');
    form.setFieldValue('priceType', data.priceType ?? '');
    form.setFieldValue('maxCheques', data.maxCheques == null ? '' : String(data.maxCheques));
    form.setFieldValue('deposit', data.deposit ?? '');
    form.setFieldValue('mortgageStatus', data.mortgageStatus ?? '');
  }, [data, form]);

  return null;
}

function PropertyFields({ form }: Readonly<{ form: InformationForm }>) {
  return (
    <form.Subscribe selector={(s) => s.values.propertyType}>
      {(propertyType) => <PropertyFieldsInner form={form} propertyType={propertyType} />}
    </form.Subscribe>
  );
}

function PropertyFieldsInner({
  form,
  propertyType,
}: Readonly<{ form: InformationForm; propertyType: string }>) {
  const { data: ptData } = usePropertyTypes();
  const unitTypeOptions = ptData.unitTypesByType[propertyType] ?? [];

  return (
    <>
      <form.AppField name="unitType">
        {(field) => (
          <field.Select
            label="Unit Type"
            options={unitTypeOptions}
            placeholder="Select unit type"
          />
        )}
      </form.AppField>
      <form.AppField name="bedrooms">
        {(field) => (
          <field.Input label="Bedrooms" required placeholder="e.g. 3" keyboardType="numeric" />
        )}
      </form.AppField>
      <form.AppField name="builtUpArea">
        {(field) => (
          <field.Input
            label="Built-up Area (sq ft)"
            placeholder="e.g. 1200"
            keyboardType="numeric"
          />
        )}
      </form.AppField>
      <form.AppField name="bathrooms">
        {(field) => (
          <field.Input label="Bathrooms" required placeholder="e.g. 2" keyboardType="numeric" />
        )}
      </form.AppField>
      <form.AppField name="furnishing">
        {(field) => (
          <field.Select
            label="Furnishing"
            options={FURNISHING_OPTIONS}
            placeholder="Select furnishing"
          />
        )}
      </form.AppField>
      <form.AppField name="view">
        {(field) => <field.Select label="View" options={VIEW_OPTIONS} placeholder="Select view" />}
      </form.AppField>
      <form.AppField name="projectBuilding">
        {(field) => <field.Input label="Project / Building" placeholder="e.g. Marina Tower" />}
      </form.AppField>

      {/* Exact Property Identification — grouped sub-block (mirrors web). */}
      <View className="mt-1 gap-3 rounded-xl border border-border/60 bg-muted/20 p-3">
        <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Exact Property Identification
        </Text>
        <form.AppField name="towerBlock">
          {(field) => <field.Input label="Tower / Block" placeholder="e.g. A" />}
        </form.AppField>
        <form.AppField name="unitNumber">
          {(field) => <field.Input label="Unit Number" required placeholder="e.g. 1204" />}
        </form.AppField>
        <form.AppField name="floor">
          {(field) => <field.Input label="Floor" placeholder="e.g. 12" keyboardType="numeric" />}
        </form.AppField>
        <form.AppField name="projectAddress">
          {(field) => <field.Input label="Project Address" placeholder="Street / area address" />}
        </form.AppField>
      </View>
    </>
  );
}
