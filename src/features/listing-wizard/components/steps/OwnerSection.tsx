import { useEffect } from 'react';

import {
  GENDER_OPTIONS,
  NATIONALITY_OPTIONS,
  OWNER_SOURCE_OPTIONS,
  SPOKEN_LANGUAGE_OPTIONS,
} from '../../constants';
import type { InformationForm } from '../../forms/information.form';
import { useLeadDetailQuery, useOwnerLeads, useWizardAgents } from '../../hooks/use-wizard-options';
import { ApiSelectField } from '../ApiSelectField';
import { WizardCard } from '../WizardCard';
import { SegmentedToggle } from './SegmentedToggle';

export function OwnerSection({
  form,
  editMode = false,
}: Readonly<{ form: InformationForm; editMode?: boolean }>) {
  const leads = useOwnerLeads();
  const agents = useWizardAgents();

  return (
    <WizardCard
      icon="User"
      title="Owner Info"
      description="Capture the owner's contact + identity details for this listing."
    >
      {/* Edit mode edits the linked owner directly — no new/existing switch or
          auto-prefill (fields are already seeded from the server). */}
      {editMode ? null : (
        <>
          <form.Subscribe selector={(s) => s.values.ownerSourceMode}>
            {(mode) => (
              <>
                <SegmentedToggle
                  value={mode}
                  onChange={(v) => {
                    form.setFieldValue('ownerSourceMode', v as 'brand_new' | 'existing_owner');
                    if (v === 'brand_new') form.setFieldValue('existingOwnerId', '');
                  }}
                  left={{ value: 'brand_new', label: 'Create new owner' }}
                  right={{ value: 'existing_owner', label: 'Select existing owner' }}
                />
                {mode === 'existing_owner' ? (
                  <form.AppField name="existingOwnerId">
                    {() => (
                      <ApiSelectField
                        label="Existing Owner"
                        placeholder="Search owner"
                        options={leads.data}
                        isLoading={leads.isLoading}
                        isError={leads.isError}
                        onRetry={() => leads.refetch()}
                        onSelected={(id) => form.setFieldValue('existingOwnerId', id ?? '')}
                      />
                    )}
                  </form.AppField>
                ) : null}
              </>
            )}
          </form.Subscribe>

          <OwnerPrefill form={form} />
        </>
      )}

      <form.AppField name="ownerName">
        {(field) => <field.Input label="Name" required placeholder="Owner name" />}
      </form.AppField>
      <form.AppField name="ownerEmail">
        {(field) => (
          <field.Input label="Email" placeholder="owner@email.com" keyboardType="email-address" />
        )}
      </form.AppField>
      <form.AppField name="ownerPhone">
        {(field) => <field.PhoneInput label="Phone" required />}
      </form.AppField>
      <form.AppField name="ownerSecondaryPhone">
        {(field) => <field.PhoneInput label="Secondary Phone" />}
      </form.AppField>
      <form.AppField name="ownerGender">
        {(field) => (
          <field.Select label="Gender" options={GENDER_OPTIONS} placeholder="Select gender" />
        )}
      </form.AppField>
      <form.AppField name="ownerBirthdate">
        {(field) => <field.DatePicker label="Date of Birth" />}
      </form.AppField>
      <form.AppField name="ownerSource">
        {(field) => (
          <field.Select label="Source" options={OWNER_SOURCE_OPTIONS} placeholder="Select source" />
        )}
      </form.AppField>
      <form.AppField name="ownerNationality">
        {(field) => (
          <field.Select
            label="Nationality"
            options={NATIONALITY_OPTIONS}
            placeholder="Select nationality"
          />
        )}
      </form.AppField>
      <form.AppField name="ownerLanguages">
        {(field) => (
          <field.MultiSelect
            label="Spoken Languages"
            options={SPOKEN_LANGUAGE_OPTIONS}
            placeholder="Select languages"
          />
        )}
      </form.AppField>
      <form.AppField name="assigneeId">
        {() => (
          <ApiSelectField
            label="Listing Assignee"
            placeholder="Select agent"
            options={agents.data}
            isLoading={agents.isLoading}
            isError={agents.isError}
            onRetry={() => agents.refetch()}
          />
        )}
      </form.AppField>
    </WizardCard>
  );
}

/** Prefills owner fields when an existing owner is chosen. */
function OwnerPrefill({ form }: Readonly<{ form: InformationForm }>) {
  return (
    <form.Subscribe selector={(s) => s.values.existingOwnerId}>
      {(ownerId) => <OwnerPrefillInner form={form} ownerId={ownerId} />}
    </form.Subscribe>
  );
}

function OwnerPrefillInner({
  form,
  ownerId,
}: Readonly<{ form: InformationForm; ownerId: string }>) {
  const { data } = useLeadDetailQuery(ownerId || undefined);
  useEffect(() => {
    if (!data) return;
    form.setFieldValue('ownerName', data.name ?? '');
    form.setFieldValue('ownerEmail', data.email ?? '');
    form.setFieldValue('ownerPhone', data.phone ?? '');
    form.setFieldValue('ownerGender', data.gender ?? '');
    form.setFieldValue('ownerBirthdate', data.birthdate ?? '');
    form.setFieldValue('ownerSource', data.source ?? '');
    form.setFieldValue('ownerNationality', data.nationality ?? '');
    form.setFieldValue('ownerLanguages', data.languages ?? []);
  }, [data, form]);
  return null;
}
