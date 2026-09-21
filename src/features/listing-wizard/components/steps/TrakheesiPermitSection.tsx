import { View } from 'react-native';

import { Text } from '@/components/atoms/Text';

import type { WizardPermit } from '../../portals.model';
import { SingleImageField } from '../SingleImageField';
import { LabeledDatePicker, LabeledInput } from './LabeledField';

/**
 * Trakheesi permit — DLD compliance fields + QR upload. Shown when a compliance portal
 * (Our website or Property Finder) is enabled. Mirrors the web Step5Publish permit block.
 */
export function TrakheesiPermitSection({
  permit,
  onChange,
}: Readonly<{
  permit: WizardPermit;
  onChange: (patch: Partial<WizardPermit>) => void;
}>) {
  return (
    <View className="gap-4">
      <Text className="text-xs text-muted-foreground">
        Enter the Trakheesi permit details. All fields are required before the listing can go live.
      </Text>
      <LabeledInput
        label="Permit Number"
        required
        value={permit.permitNumber}
        onChangeText={(t) => onChange({ permitNumber: t })}
        placeholder="e.g. 71135-12345"
      />
      <LabeledInput
        label="Permit URL"
        value={permit.permitUrl}
        onChangeText={(t) => onChange({ permitUrl: t })}
        placeholder="https://trakheesi.dubailand.gov.ae/..."
        keyboardType="url"
      />
      <LabeledDatePicker
        label="Application Date"
        required
        value={permit.applicationDate}
        onChangeText={(t) => onChange({ applicationDate: t })}
        placeholder="Select date"
      />
      <LabeledDatePicker
        label="Expiry Date"
        required
        value={permit.expiryDate}
        onChangeText={(t) => onChange({ expiryDate: t })}
        placeholder="Select date"
      />
      <SingleImageField
        label="QR Code"
        value={permit.qrCode}
        onChange={(v) => onChange({ qrCode: v })}
      />
    </View>
  );
}
