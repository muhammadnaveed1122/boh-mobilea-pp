import { useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/atoms/Text';

import { AVAILABILITY_OPTIONS, AVAILABILITY_OPTIONS_RENT } from '../../constants';
import type { InformationForm } from '../../forms/information.form';
import { useListingUnitTypes, useWizardAgents } from '../../hooks/use-wizard-options';
import { getListingProjectsPage } from '../../services';
import type { ProjectOption } from '../../services';
import { ApiSelectField } from '../ApiSelectField';
import { RemoteSearchSelect } from '../RemoteSearchSelect';
import { WizardCard } from '../WizardCard';

export function PrimaryProjectSection({ form }: Readonly<{ form: InformationForm }>) {
  const agents = useWizardAgents();
  const [developerName, setDeveloperName] = useState<string | undefined>(undefined);

  return (
    <WizardCard
      icon="Building2"
      title="Project"
      description="Pick the project — developer auto-fills."
    >
      <form.AppField name="projectId">
        {() => (
          <RemoteSearchSelect<ProjectOption>
            label="Project"
            required
            placeholder="Select project"
            queryKey={['wizard', 'projects-search']}
            fetchPage={getListingProjectsPage}
            onSelected={(opt) => {
              form.setFieldValue('developerId', opt?.developerId ?? '');
              form.setFieldValue('unitType', '');
              setDeveloperName(opt?.developerName ?? undefined);
            }}
          />
        )}
      </form.AppField>

      <View>
        <Text className="mb-1 text-sm text-foreground">Developer</Text>
        <View className="h-12 justify-center rounded-xl border border-border bg-muted px-3">
          <Text className="text-sm text-muted-foreground">{developerName ?? '—'}</Text>
        </View>
      </View>

      <form.Subscribe
        selector={(s) => ({ projectId: s.values.projectId, purpose: s.values.purpose })}
      >
        {({ projectId, purpose }) => (
          <UnitTypeField form={form} projectId={projectId} purpose={purpose} />
        )}
      </form.Subscribe>

      <form.Subscribe selector={(s) => s.values.purpose}>
        {(purpose) => (
          <form.AppField name="availability">
            {(field) => (
              <field.Select
                label="Availability"
                options={purpose === 'rent' ? AVAILABILITY_OPTIONS_RENT : AVAILABILITY_OPTIONS}
                placeholder="Select availability"
              />
            )}
          </form.AppField>
        )}
      </form.Subscribe>

      <form.AppField name="assigneeId">
        {() => (
          <ApiSelectField
            label="Assigned Agent"
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

function UnitTypeField({
  form,
  projectId,
  purpose,
}: Readonly<{ form: InformationForm; projectId: string; purpose: string }>) {
  const unitTypes = useListingUnitTypes(projectId || undefined);
  const options = unitTypes.data.map((u) => ({
    value: u.value,
    label: (u.usedPurposes ?? []).includes(purpose) ? `${u.label} (already listed)` : u.label,
  }));
  return (
    <form.AppField name="unitType">
      {() => (
        <ApiSelectField
          label="Unit Type"
          placeholder="Select unit type"
          options={options}
          isLoading={unitTypes.isLoading}
          isError={unitTypes.isError}
          onRetry={() => unitTypes.refetch()}
          disabled={!projectId}
        />
      )}
    </form.AppField>
  );
}
