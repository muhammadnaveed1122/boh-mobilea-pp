import { useState } from 'react';
import type { InformationForm } from '../../forms/information.form';
import type { Opt } from '../../types';
import { getNeighbourhoodsPage } from '../../services';
import { CommunityMap } from '../CommunityMap';
import { RemoteSearchSelect } from '../RemoteSearchSelect';
import { WizardCard } from '../WizardCard';

export function LocationSection({
  form,
  initialCommunityName,
}: Readonly<{ form: InformationForm; initialCommunityName?: string }>) {
  const [communityName, setCommunityName] = useState<string | undefined>(initialCommunityName);

  return (
    <WizardCard
      icon="MapPin"
      title="Location"
      description="Select the community — it seeds the listing's location."
    >
      <form.AppField name="neighbourhoodId">
        {() => (
          <RemoteSearchSelect
            label="Community"
            required
            placeholder="Select neighbourhood"
            queryKey={['wizard', 'neighbourhoods-search']}
            fetchPage={getNeighbourhoodsPage}
            initialLabel={initialCommunityName}
            onSelected={(opt: Opt | undefined) => setCommunityName(opt?.label)}
          />
        )}
      </form.AppField>
      <CommunityMap communityName={communityName} />
    </WizardCard>
  );
}
