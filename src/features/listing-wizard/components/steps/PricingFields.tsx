import { View } from 'react-native';

import {
  MAX_CHEQUES_OPTIONS,
  MORTGAGE_STATUS_OPTIONS,
  RENT_PRICE_TYPE_OPTIONS,
  rentPriceUnitLabel,
} from '../../constants';
import type { InformationForm } from '../../forms/information.form';

export function PricingFields({
  form,
  purpose,
}: Readonly<{ form: InformationForm; purpose: string }>) {
  const isRent = purpose === 'rent';

  if (!isRent) {
    // Sale: Asking Price + Mortgage Status.
    return (
      <View className="gap-3">
        <form.AppField name="askingPrice">
          {(field) => (
            <field.Input label="Asking Price" required keyboardType="numeric" placeholder="AED" />
          )}
        </form.AppField>
        <form.AppField name="mortgageStatus">
          {(field) => (
            <field.Select
              label="Mortgage Status"
              options={MORTGAGE_STATUS_OPTIONS}
              placeholder="Select status"
            />
          )}
        </form.AppField>
      </View>
    );
  }

  // Rent: Price Type → Price (unit follows Price Type) → Max Cheques Accepted → Deposit.
  return (
    <View className="gap-3">
      <form.AppField name="priceType">
        {(field) => (
          <field.Select label="Price Type" options={RENT_PRICE_TYPE_OPTIONS} placeholder="Per…" />
        )}
      </form.AppField>

      <form.Subscribe selector={(s) => s.values.priceType}>
        {(priceType) => (
          <form.AppField name="askingPrice">
            {(field) => (
              <field.Input
                label={`Price (${rentPriceUnitLabel(priceType)})`}
                required
                keyboardType="numeric"
                placeholder="Enter price"
              />
            )}
          </form.AppField>
        )}
      </form.Subscribe>

      <form.AppField name="maxCheques">
        {(field) => (
          <field.Select
            label="Max Cheques Accepted"
            required
            options={MAX_CHEQUES_OPTIONS}
            placeholder="Select max cheques"
          />
        )}
      </form.AppField>

      <form.AppField name="deposit">
        {(field) => <field.Input label="Deposit (AED)" keyboardType="numeric" placeholder="AED" />}
      </form.AppField>
    </View>
  );
}
