import { useEffect } from 'react';
import {
  COMPLETION_STATUS_OPTIONS,
  PURPOSE_OPTIONS,
  PURPOSE_OPTIONS_SALE_ONLY,
} from '../../constants';
import type { InformationForm } from '../../forms/information.form';
import { usePropertyTypes } from '../../hooks/use-wizard-options';
import { isOffPlan } from '../../types';
import { ApiSelectField } from '../ApiSelectField';
import { WizardCard } from '../WizardCard';

/**
 * Off-plan listings are sale-only — auto-select Purpose = 'sale' (web does the
 * same) so the user isn't left with an empty Purpose (which also hides the
 * downstream Pricing card).
 */
function OffPlanPurposeSyncInner({
  form,
  offPlan,
}: Readonly<{ form: InformationForm; offPlan: boolean }>) {
  useEffect(() => {
    if (offPlan && form.state.values.purpose !== 'sale') {
      form.setFieldValue('purpose', 'sale');
    }
  }, [offPlan, form]);
  return null;
}

export function TypeSection({ form }: Readonly<{ form: InformationForm }>) {
  const propertyTypes = usePropertyTypes();

  return (
    <WizardCard
      icon="Tag"
      title="Type"
      description="Tell us what this listing is — its type, completion status and sale/rent purpose."
    >
      <form.AppField name="propertyType">
        {() => (
          <ApiSelectField
            label="Property Type"
            placeholder="Select property type"
            options={propertyTypes.data.groupedOptions}
            isLoading={false}
            isError={false}
            onRetry={() => {}}
          />
        )}
      </form.AppField>

      <form.AppField name="completionStatus">
        {(field) => (
          <field.Select
            label="Completion Status"
            required
            options={COMPLETION_STATUS_OPTIONS}
            placeholder="Select completion status"
          />
        )}
      </form.AppField>

      <form.Subscribe selector={(s) => s.values.completionStatus}>
        {(completionStatus) => (
          <>
            <OffPlanPurposeSyncInner form={form} offPlan={isOffPlan(completionStatus)} />
            <form.AppField name="purpose">
              {(field) => (
                <field.Select
                  label="Purpose"
                  required
                  disabled={isOffPlan(completionStatus)}
                  options={
                    isOffPlan(completionStatus) ? PURPOSE_OPTIONS_SALE_ONLY : PURPOSE_OPTIONS
                  }
                  placeholder="Select purpose"
                />
              )}
            </form.AppField>
          </>
        )}
      </form.Subscribe>
    </WizardCard>
  );
}
