import { FURNISHING_OPTIONS, OCCUPANCY_OPTIONS, VIEW_OPTIONS } from '../../constants';
import type { InformationForm } from '../../forms/information.form';
import { WizardCard } from '../WizardCard';

export function PrimaryPropertySection({ form }: Readonly<{ form: InformationForm }>) {
  return (
    <WizardCard icon="House" title="Property Details" description="Configuration and features.">
      <form.AppField name="bedrooms">
        {(field) => (
          <field.Input label="Bedrooms" required placeholder="e.g. 3" keyboardType="numeric" />
        )}
      </form.AppField>

      <form.AppField name="bathrooms">
        {(field) => (
          <field.Input label="Bathrooms" required placeholder="e.g. 2" keyboardType="numeric" />
        )}
      </form.AppField>

      <form.AppField name="size">
        {(field) => (
          <field.Input label="Size (sq ft)" placeholder="e.g. 1200" keyboardType="numeric" />
        )}
      </form.AppField>

      <form.AppField name="view">
        {(field) => <field.Select label="View" options={VIEW_OPTIONS} placeholder="Select view" />}
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

      <form.AppField name="floor">
        {(field) => <field.Input label="Floor" placeholder="e.g. 12" keyboardType="numeric" />}
      </form.AppField>

      <form.AppField name="totalFloors">
        {(field) => (
          <field.Input label="Total Floors" placeholder="e.g. 30" keyboardType="numeric" />
        )}
      </form.AppField>

      <form.AppField name="buildYear">
        {(field) => (
          <field.Input label="Build Year" placeholder="e.g. 2022" keyboardType="numeric" />
        )}
      </form.AppField>

      <form.AppField name="occupancy">
        {(field) => (
          <field.Select
            label="Occupancy"
            options={OCCUPANCY_OPTIONS}
            placeholder="Select occupancy"
          />
        )}
      </form.AppField>

      <form.AppField name="parking">
        {(field) => <field.Input label="Parking" placeholder="e.g. 1" keyboardType="numeric" />}
      </form.AppField>

      <form.Subscribe selector={(s) => s.values.purpose}>
        {(purpose) => (
          <form.AppField name="availabilityDate">
            {(field) => (
              <field.DatePicker label="Availability Date" required={purpose === 'rent'} />
            )}
          </form.AppField>
        )}
      </form.Subscribe>

      <form.AppField name="publicUnitNo">
        {(field) => <field.Input label="Public Unit No." placeholder="e.g. A-104" />}
      </form.AppField>

      <form.AppField name="privateUnitNo">
        {(field) => <field.Input label="Private Unit No." placeholder="Internal reference" />}
      </form.AppField>
    </WizardCard>
  );
}
