/**
 * LeadDetailScreen — page shell + hero header + tab switcher.
 *
 * Loads the lead via `useLeadDetail`, resolves RBAC gates via
 * `useLeadPermissions`, and wraps the entire detail body in a
 * `LeadFormProvider` so Edit / Save / Cancel + dirty tracking live in one
 * place.
 */

import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { BackButton } from '@/components/atoms/BackButton';
import { Icon } from '@/components/atoms/Icon';
import { TabsContent } from '@/components/atoms/Tabs';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';

import { LeadFormProvider, useLeadFormContext } from '../context/LeadFormContext';
import { leadToFormValues } from '../form/model-adapter';
import { useLeadDetail } from '../hooks/use-lead-detail';
import { useLeadDetailUpdate } from '../hooks/use-lead-detail-update';
import { useLeadPermissions, type LeadPermissions } from '../hooks/use-lead-permissions';
import type { LeadDetail } from '../models/lead-detail';

import { ActivityLogTab } from './lead-detail/ActivityLogTab';
import { HeroHeaderCard } from './lead-detail/HeroHeaderCard';
import { InitialLeadDetailsCard } from './lead-detail/InitialLeadDetailsCard';
import { LeadDetailSkeleton } from './lead-detail/LeadDetailSkeleton';
import { LeadDetailTabs, type LeadDetailTabValue } from './lead-detail/LeadDetailTabs';
import { LeadProfileCard } from './lead-detail/LeadProfileCard';
import { LeadRequirementsCard } from './lead-detail/LeadRequirementsCard';
import { LinkedListingsCard } from './lead-detail/LinkedListingsCard';
import { NotesTab } from './lead-detail/NotesTab';
import { PropertyTaxonomyCard } from './lead-detail/PropertyTaxonomyCard';

interface ScreenChromeProps {
  children: React.ReactNode;
  paddingTop: number;
}

function ScreenChrome({ children, paddingTop }: Readonly<ScreenChromeProps>) {
  return (
    <View className="flex-1 bg-background" style={{ paddingTop }}>
      {children}
    </View>
  );
}

interface TopBarProps {
  /** Right-hand action slot. Hosts Edit / Save / Cancel buttons. */
  rightSlot?: React.ReactNode;
}

function TopBar({ rightSlot }: Readonly<TopBarProps>) {
  return (
    <View className="flex-row items-center justify-between px-4 pb-3 pt-2">
      <BackButton />
      <Text className="text-base font-bold text-foreground">Lead Detail</Text>
      <View className="min-h-10 min-w-10 flex-row items-center justify-end gap-2">{rightSlot}</View>
    </View>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

function ErrorState({ message, onRetry }: Readonly<ErrorStateProps>) {
  const destructive = useThemeColor('--destructive');
  return (
    <View className="flex-1 items-center justify-center px-6">
      <Icon name="CircleAlert" size={32} color={destructive} />
      <Text className="mt-3 text-center text-base font-semibold text-destructive">{message}</Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        className="mt-4 rounded-lg bg-brand px-4 py-2 active:opacity-80"
      >
        <Text className="text-sm font-semibold text-brand-foreground">Retry</Text>
      </Pressable>
    </View>
  );
}

function NotFoundState() {
  return (
    <View className="flex-1 items-center justify-center px-6">
      <Icon name="Inbox" size={32} />
      <Text className="mt-3 text-base text-muted-foreground">Lead not found</Text>
      <Pressable
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
            return;
          }
          router.replace('/leads');
        }}
        accessibilityRole="button"
        className="mt-4 rounded-lg bg-brand px-4 py-2 active:opacity-80"
      >
        <Text className="text-sm font-semibold text-brand-foreground">Go back</Text>
      </Pressable>
    </View>
  );
}

/**
 * Re-key the flat context error map onto `FieldKey`s so the requirement
 * cards / `RequirementField` can look up messages by their form key.
 *
 * The context error map is keyed by `LeadDetail` fields (`interest`,
 * `interestType`, ...). Only persona/purpose differ from their form key;
 * every other key passes through unchanged.
 */
function toFieldErrors(
  errors: Partial<Record<string, string>>,
): Record<string, string | undefined> {
  const { interest, interestType, ...rest } = errors;
  return {
    ...rest,
    persona: interest,
    purpose: interestType,
  };
}

interface TopBarActionsProps {
  canUpdate: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  isEditing: boolean;
  isSaving: boolean;
  hasChanges: boolean;
}

function TopBarActions({
  canUpdate,
  onEdit,
  onCancel,
  onSave,
  isEditing,
  isSaving,
  hasChanges,
}: Readonly<TopBarActionsProps>) {
  const fg = useThemeColor('--foreground');
  const brandFg = useThemeColor('--primary-foreground');

  if (!isEditing) {
    if (!canUpdate) {
      return null;
    }
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Edit lead"
        onPress={onEdit}
        className="h-10 flex-row items-center gap-1 rounded-full px-2 active:opacity-70"
      >
        <Icon name="Pencil" size={16} color={fg} />
        <Text className="text-sm font-semibold text-foreground">Edit</Text>
      </Pressable>
    );
  }

  const saveDisabled = !hasChanges || isSaving;

  return (
    <View className="flex-row items-center gap-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cancel editing"
        onPress={onCancel}
        disabled={isSaving}
        className="h-10 flex-row items-center justify-center rounded-full px-3 active:opacity-70"
      >
        <Text className="text-sm font-semibold text-foreground">Cancel</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Save lead changes"
        accessibilityState={{ disabled: saveDisabled, busy: isSaving }}
        onPress={onSave}
        disabled={saveDisabled}
        className="h-10 flex-row items-center justify-center gap-1.5 rounded-full bg-success px-3.5 active:opacity-80"
        style={{ opacity: saveDisabled ? 0.5 : 1 }}
      >
        {isSaving ? (
          <ActivityIndicator size="small" color={brandFg} />
        ) : (
          <Icon name="Check" size={16} color={brandFg} />
        )}
        <Text className="text-sm font-semibold text-success-foreground">Save</Text>
      </Pressable>
    </View>
  );
}

interface DetailsTabBodyProps {
  lead: LeadDetail;
  canUpdate: boolean;
}

function DetailsTabBody({ lead, canUpdate }: Readonly<DetailsTabBodyProps>) {
  const { values, setField, isEditing, errors } = useLeadFormContext();

  const formValues = useMemo(() => leadToFormValues(values), [values]);
  const fieldErrors = useMemo(() => toFieldErrors(errors), [errors]);

  const interactive = isEditing && canUpdate;

  return (
    <View className="gap-3 pt-4">
      <LeadProfileCard lead={lead} />
      <InitialLeadDetailsCard lead={lead} />
      <LeadRequirementsCard
        lead={lead}
        isEditing={interactive}
        canUpdate={canUpdate}
        values={formValues}
        onChange={setField}
        errors={fieldErrors}
      />
      <PropertyTaxonomyCard
        purpose={formValues.purpose}
        values={formValues}
        onChange={setField}
        isEditing={interactive}
        errors={fieldErrors}
      />
      <LinkedListingsCard lead={lead} />
    </View>
  );
}

interface LeadDetailBodyProps {
  lead: LeadDetail;
  permissions: LeadPermissions;
  leadId: string;
  insetsBottom: number;
}

/**
 * Renders the lead body (top bar + scroll content) inside the form provider
 * so cards + the top bar actions all share one form state.
 */
function LeadDetailBody({
  lead,
  permissions,
  leadId,
  insetsBottom,
}: Readonly<LeadDetailBodyProps>) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<LeadDetailTabValue>('details');
  const { isEditing, setIsEditing, hasChanges } = useLeadFormContext();
  const { save, cancel, isSaving } = useLeadDetailUpdate(leadId);

  return (
    <ScreenChrome paddingTop={insets.top}>
      <TopBar
        rightSlot={
          <TopBarActions
            canUpdate={permissions.canUpdate}
            isEditing={isEditing}
            isSaving={isSaving}
            hasChanges={hasChanges}
            onEdit={() => setIsEditing(true)}
            onCancel={cancel}
            onSave={() => {
              save().catch(() => {
                /* surfaced via in-hook alert */
              });
            }}
          />
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 + insetsBottom }}
        showsVerticalScrollIndicator={false}
      >
        <HeroHeaderCard
          lead={lead}
          canViewContact={permissions.canViewContact}
          canCall={permissions.canCall}
          canChat={permissions.canChat}
        />

        <View className="mt-4 px-4">
          <LeadDetailTabs value={tab} onValueChange={setTab}>
            <TabsContent value="details">
              <DetailsTabBody lead={lead} canUpdate={permissions.canUpdate} />
            </TabsContent>
            <TabsContent value="activity">
              <View className="pt-4">
                <ActivityLogTab leadId={leadId} canViewContact={permissions.canViewContact} />
              </View>
            </TabsContent>
            <TabsContent value="notes">
              <View className="pt-4">
                <NotesTab leadId={leadId} canAddNote={permissions.canUpdate} />
              </View>
            </TabsContent>
          </LeadDetailTabs>
        </View>
      </ScrollView>
    </ScreenChrome>
  );
}

export interface LeadDetailScreenProps {
  id: string;
}

export function LeadDetailScreen({ id }: Readonly<LeadDetailScreenProps>) {
  const insets = useSafeAreaInsets();

  const { data: lead, isLoading, isError, error, refetch } = useLeadDetail(id);
  const permissions = useLeadPermissions(lead);

  if (isLoading) {
    return (
      <ScreenChrome paddingTop={insets.top}>
        <TopBar />
        <LeadDetailSkeleton />
      </ScreenChrome>
    );
  }

  if (isError) {
    return (
      <ScreenChrome paddingTop={insets.top}>
        <TopBar />
        <ErrorState
          message={error?.message ?? 'Failed to load lead'}
          onRetry={() => {
            refetch().catch(() => {
              /* surfaced via `isError` */
            });
          }}
        />
      </ScreenChrome>
    );
  }

  if (!lead) {
    return (
      <ScreenChrome paddingTop={insets.top}>
        <TopBar />
        <NotFoundState />
      </ScreenChrome>
    );
  }

  return (
    <LeadFormProvider lead={lead}>
      <LeadDetailBody
        lead={lead}
        permissions={permissions}
        leadId={id}
        insetsBottom={insets.bottom}
      />
    </LeadFormProvider>
  );
}
