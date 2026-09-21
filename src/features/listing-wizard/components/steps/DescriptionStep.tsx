import { ScrollView, View } from 'react-native';

import type { DescriptionForm } from '../../forms/description.form';
import { WizardCard } from '../WizardCard';

/**
 * Description step (wizard step 2) — the hero Title + Description used for portals such as
 * Property Finder. Mirrors the web `descriptionOnly` content tab (single "Hero & Basics" card).
 */
export function DescriptionStep({ form }: Readonly<{ form: DescriptionForm }>) {
  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View className="gap-4">
        <WizardCard
          icon="FileText"
          title="Hero & Basics"
          description="The title and description used for portals such as Property Finder."
        >
          <form.AppField name="title">
            {(field) => <field.Input label="Title" required placeholder="Title" />}
          </form.AppField>

          <form.AppField name="description">
            {(field) => (
              <field.Textarea
                label="Description"
                required
                numberOfLines={5}
                placeholder="Describe the property — sent to Property Finder on publish."
              />
            )}
          </form.AppField>
        </WizardCard>
      </View>
    </ScrollView>
  );
}
