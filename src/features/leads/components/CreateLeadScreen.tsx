import * as React from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { PortalHost } from '@rn-primitives/portal';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useCreateLeadForm } from '../forms/create-lead.form';
import type { CreateLeadFormValues } from '../forms/create-lead.schema';
import { useCreateLead } from '../hooks/use-create-lead';
import {
  INTEREST_LABEL,
  INTEREST_TYPE_LABEL,
  PRIORITY_LABEL,
  PROPERTY_TYPE_LABEL,
  type LeadInterest,
  type LeadInterestType,
  type LeadPriority,
  type LeadPropertyType,
} from '../types';

const INTEREST_OPTIONS = (Object.keys(INTEREST_LABEL) as LeadInterest[]).map((v) => ({
  value: v,
  label: INTEREST_LABEL[v],
}));
const INTEREST_TYPE_OPTIONS = (Object.keys(INTEREST_TYPE_LABEL) as LeadInterestType[]).map((v) => ({
  value: v,
  label: INTEREST_TYPE_LABEL[v],
}));
const PROPERTY_TYPE_OPTIONS = (Object.keys(PROPERTY_TYPE_LABEL) as LeadPropertyType[]).map((v) => ({
  value: v,
  label: PROPERTY_TYPE_LABEL[v],
}));
const PRIORITY_OPTIONS = (Object.keys(PRIORITY_LABEL) as LeadPriority[]).map((v) => ({
  value: v,
  label: PRIORITY_LABEL[v],
}));

const PORTAL_HOST = 'create-lead-modal';

function SectionTitle({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </Text>
  );
}

export function CreateLeadScreen() {
  const insets = useSafeAreaInsets();
  const createLead = useCreateLead();
  const [barHeight, setBarHeight] = React.useState(96);
  const { name, phone, email } = useLocalSearchParams<{
    name?: string;
    phone?: string;
    email?: string;
  }>();

  const handleSubmit = async (values: CreateLeadFormValues) => {
    try {
      await createLead.mutateAsync({
        leadType: 'manual',
        channel: 'manual',
        name: values.name,
        email: values.email,
        phone: values.phone,
        interest: values.interest,
        interestType: values.interestType ? [values.interestType] : undefined,
        propertyType: values.propertyType,
        priority: values.priority,
        additionalNotes: values.additionalNotes || undefined,
      });
      Alert.alert('Lead created', 'The lead has been added.');
      router.back();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create lead. Please try again.';
      Alert.alert('Create failed', msg);
    }
  };

  const form = useCreateLeadForm({
    onSubmit: handleSubmit,
    defaults: {
      ...(name ? { name } : {}),
      ...(phone ? { phone } : {}),
      ...(email ? { email } : {}),
    },
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
          <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Icon name="X" size={22} />
            </Pressable>
            <Text className="text-base font-semibold text-foreground">Create New Lead</Text>
            <View style={{ width: 22 }} />
          </View>

          <KeyboardAwareScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 20,
              paddingBottom: barHeight + 24,
            }}
            bottomOffset={barHeight + 16}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
          >
            <View className="gap-6">
              <View className="gap-3">
                <SectionTitle>Contact</SectionTitle>
                <form.AppField name="name">
                  {(field) => (
                    <field.Input
                      label="Full Name"
                      required
                      placeholder="Enter full name"
                      autoCapitalize="words"
                    />
                  )}
                </form.AppField>
                <form.AppField name="email">
                  {(field) => (
                    <field.Input
                      label="Email"
                      required
                      placeholder="name@example.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                    />
                  )}
                </form.AppField>
                <form.AppField name="phone">
                  {(field) => <field.PhoneInput label="Phone" required />}
                </form.AppField>
              </View>

              <View className="gap-3">
                <SectionTitle>Lead Info</SectionTitle>
                <form.AppField name="interest">
                  {(field) => (
                    <field.Select
                      label="Persona"
                      placeholder="Select persona"
                      options={INTEREST_OPTIONS}
                      portalHost={PORTAL_HOST}
                    />
                  )}
                </form.AppField>
                <form.AppField name="interestType">
                  {(field) => (
                    <field.Select
                      label="Intent"
                      placeholder="Select intent"
                      options={INTEREST_TYPE_OPTIONS}
                      portalHost={PORTAL_HOST}
                    />
                  )}
                </form.AppField>
                <form.AppField name="priority">
                  {(field) => (
                    <field.Select
                      label="Priority"
                      placeholder="Select priority"
                      options={PRIORITY_OPTIONS}
                      portalHost={PORTAL_HOST}
                    />
                  )}
                </form.AppField>
              </View>

              <View className="gap-3">
                <SectionTitle>Property</SectionTitle>
                <form.AppField name="propertyType">
                  {(field) => (
                    <field.Select
                      label="Property Type"
                      placeholder="Select property type"
                      options={PROPERTY_TYPE_OPTIONS}
                      portalHost={PORTAL_HOST}
                    />
                  )}
                </form.AppField>
              </View>

              <View className="gap-3">
                <SectionTitle>Notes</SectionTitle>
                <form.AppField name="additionalNotes">
                  {(field) => (
                    <field.Textarea
                      label="Additional Notes"
                      placeholder="Any extra context for the agent…"
                      numberOfLines={4}
                    />
                  )}
                </form.AppField>
              </View>
            </View>
          </KeyboardAwareScrollView>

          <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
            <View
              onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}
              className="border-t border-border bg-background px-5 py-3"
              style={{ paddingBottom: 12 + insets.bottom }}
            >
              <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
                {([canSubmit, isSubmitting]) => (
                  <Button
                    onPress={() => {
                      form.handleSubmit().catch(() => {});
                    }}
                    disabled={!canSubmit || createLead.isPending}
                    loading={isSubmitting || createLead.isPending}
                  >
                    <Text>Create Lead</Text>
                  </Button>
                )}
              </form.Subscribe>
            </View>
          </KeyboardStickyView>
          <PortalHost name={PORTAL_HOST} />
        </View>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
