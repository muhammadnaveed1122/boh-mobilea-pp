import type { InformationForm } from '../../forms/information.form';
import { WizardCard } from '../WizardCard';
import { PricingFields } from './PricingFields';

export function PricingSection({ form }: Readonly<{ form: InformationForm }>) {
  return (
    <form.Subscribe selector={(s) => s.values.purpose}>
      {(purpose) => {
        if (purpose !== 'sale' && purpose !== 'rent') return null;
        return (
          <WizardCard
            icon="Wallet"
            title="Pricing"
            description={
              purpose === 'rent'
                ? 'Rent price, cheques and deposit.'
                : 'Sale price and mortgage status.'
            }
          >
            <PricingFields form={form} purpose={purpose} />
          </WizardCard>
        );
      }}
    </form.Subscribe>
  );
}
