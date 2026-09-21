import { ScrollView, View } from 'react-native';

import { TypeSection } from './TypeSection';
import { LocationSection } from './LocationSection';
import { OwnerSection } from './OwnerSection';
import { SecondaryPropertySection } from './SecondaryPropertySection';
import { PrimaryProjectSection } from './PrimaryProjectSection';
import { PrimaryPropertySection } from './PrimaryPropertySection';
import { PricingSection } from './PricingSection';
import { branchFor } from '../../types';
import type { InformationForm } from '../../forms/information.form';

export function InformationStep({
  form,
  editMode = false,
  initialCommunityName,
}: Readonly<{ form: InformationForm; editMode?: boolean; initialCommunityName?: string }>) {
  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View className="gap-4">
        <TypeSection form={form} />
        <LocationSection form={form} initialCommunityName={initialCommunityName} />
        <form.Subscribe selector={(s) => s.values.completionStatus}>
          {(status) => {
            const branch = branchFor(status);
            if (branch === 'secondary') {
              return (
                <>
                  <OwnerSection form={form} editMode={editMode} />
                  <SecondaryPropertySection form={form} editMode={editMode} />
                  <PricingSection form={form} />
                </>
              );
            }
            if (branch === 'primary') {
              return (
                <>
                  <PrimaryProjectSection form={form} />
                  <PrimaryPropertySection form={form} />
                  <PricingSection form={form} />
                </>
              );
            }
            return null;
          }}
        </form.Subscribe>
      </View>
    </ScrollView>
  );
}
