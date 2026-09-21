import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useStore } from '@tanstack/react-form';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BackButton } from '@/components/atoms/BackButton';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { showToast } from '@/lib/toast/toast.store';
import { useDescriptionForm } from '../forms/description.form';
import { useInformationForm } from '../forms/information.form';
import { useCreateListing } from '../hooks/use-create-listing';
import { useListingEditHydration, type EditHydration } from '../hooks/use-listing-edit-hydration';
import { useReviewMutations } from '../hooks/use-review-mutations';
import { useSaveAmenities } from '../hooks/use-save-amenities';
import { useSaveContent, type WizardCreated } from '../hooks/use-save-content';
import { useSaveMedia, type WizardContentInput } from '../hooks/use-save-media';
import { useSavePortals } from '../hooks/use-save-portals';
import { useUpdateListing } from '../hooks/use-update-listing';
import type { InformationValues } from '../forms/information.schema';
import type { WizardDocItem } from '../media/types';
import {
  EMPTY_PUBLISH,
  EMPTY_WEBSITE_CONTENT,
  type WizardPublish,
  type WizardWebsiteContent,
} from '../portals.model';
import {
  canSubmitGoLive,
  canSubmitUpdate,
  isAwaitingPublish,
  isAwaitingUpdate,
  isContentLockedForReview,
  isEditingFrozen,
  isPermitValidForPublish,
  nextSubmitStatus,
  resolveFooterSubmit,
  resourceTypeForBranch,
  type FooterSubmitAction,
  type ReviewState,
} from '../review-state';
import { branchFor, type ListingBranch } from '../types';
import { useAcknowledge } from '@/features/approvals/hooks/use-acknowledge';
import { useResourceApprovalStatus } from '@/features/approvals/hooks/use-resource-approval-status';
import { ActivitySheet } from './ActivitySheet';
import { RequestChangesDialog } from './RequestChangesDialog';
import { ReviewBanner } from './ReviewBanner';
import { DescriptionStep } from './steps/DescriptionStep';
import { InformationStep } from './steps/InformationStep';
import { MediaStep } from './steps/MediaStep';
import { PortalsStep } from './steps/PortalsStep';
import { WizardFooter } from './WizardFooter';
import { WizardStepper } from './WizardStepper';

type SubmitMode = 'draft' | 'continue';

const EMPTY_CONTENT: WizardContentInput = {
  title: '',
  description: '',
  heroMedia: [],
  aboutImage1: null,
  aboutImage2: null,
  videoLink: '',
  view360Link: '',
  selectedAmenityIds: [],
};

/** Footer for the active step. In edit, an unchanged step shows "Next" (skip); a
 *  changed step (or create) shows the save action. Kept separate to keep the
 *  wizard body's branching manageable. */
function StepFooter({
  stepIndex,
  isEdit,
  pendingMode,
  dirty,
  onCancel,
  onSaveDraftInfo,
  saveInfo,
  saveDesc,
  saveMedia,
  savePortals,
  goTo,
  finish,
  reviewSubmit,
  onSubmitForReview,
}: Readonly<{
  stepIndex: number;
  isEdit: boolean;
  pendingMode: SubmitMode | null;
  dirty: { info: boolean; desc: boolean; media: boolean; portals: boolean };
  onCancel: () => void;
  onSaveDraftInfo: () => void;
  saveInfo: () => void;
  saveDesc: () => void;
  saveMedia: () => void;
  savePortals: () => void;
  goTo: (index: number) => void;
  finish: () => void;
  /** Terminal (Portals-step) review action resolved from role + status. */
  reviewSubmit: FooterSubmitAction;
  onSubmitForReview: () => void;
}>) {
  const noop = () => {};
  const configs = [
    {
      save: saveInfo,
      next: () => goTo(1),
      saveLabel: 'Save & Continue',
      onSaveDraft: onSaveDraftInfo,
      showSaveDraft: !isEdit,
      onBack: undefined,
      dirty: dirty.info,
    },
    {
      save: saveDesc,
      next: () => goTo(2),
      saveLabel: 'Save & Continue',
      onSaveDraft: noop,
      showSaveDraft: false,
      onBack: () => goTo(0),
      dirty: dirty.desc,
    },
    {
      save: saveMedia,
      next: () => goTo(3),
      saveLabel: 'Save Media',
      onSaveDraft: noop,
      showSaveDraft: false,
      onBack: () => goTo(1),
      dirty: dirty.media,
    },
    {
      save: savePortals,
      next: finish,
      saveLabel: 'Save & Finish',
      onSaveDraft: noop,
      showSaveDraft: false,
      onBack: () => goTo(2),
      dirty: dirty.portals,
    },
  ];
  const c = configs[stepIndex] ?? configs[0];
  const skip = isEdit && !c.dirty;
  const skipLabel = stepIndex === 3 ? 'Done' : 'Next';

  // On the terminal Portals step in edit mode the review workflow governs the
  // primary action: reviewers act from the banner (hidden here), agents submit
  // for review, everyone else does a plain save.
  const isTerminal = stepIndex === 3;
  if (isEdit && isTerminal && reviewSubmit.hidden) {
    return (
      <WizardFooter
        onCancel={onCancel}
        onSaveDraft={noop}
        onCreate={noop}
        submittingMode={pendingMode}
        onBack={c.onBack}
        showSaveDraft={false}
        hidePrimary
      />
    );
  }
  if (isEdit && isTerminal && reviewSubmit.isSubmit) {
    return (
      <WizardFooter
        onCancel={onCancel}
        onSaveDraft={savePortals}
        onCreate={onSubmitForReview}
        submittingMode={pendingMode}
        primaryLabel={reviewSubmit.label}
        onBack={c.onBack}
        showSaveDraft
      />
    );
  }

  // Create's step-0 label falls back to the footer default ("Create & Continue").
  let primaryLabel: string | undefined = skip ? skipLabel : c.saveLabel;
  if (!isEdit && stepIndex === 0) primaryLabel = undefined;

  return (
    <WizardFooter
      onCancel={onCancel}
      onSaveDraft={c.onSaveDraft}
      onCreate={skip ? c.next : c.save}
      submittingMode={pendingMode}
      primaryLabel={primaryLabel}
      onBack={c.onBack}
      showSaveDraft={c.showSaveDraft}
    />
  );
}

/**
 * The wizard body. Forms are created seeded with `initial` (edit prefill) or the
 * empty defaults (create), so no post-mount reset is needed — this is why the
 * body only mounts once edit hydration has resolved.
 */
function WizardBody({ isEdit, initial }: Readonly<{ isEdit: boolean; initial?: EditHydration }>) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const createListing = useCreateListing();
  const updateListing = useUpdateListing();
  const saveContent = useSaveContent();
  const saveMedia = useSaveMedia();
  const saveAmenities = useSaveAmenities();
  const savePortals = useSavePortals();

  const [stepIndex, setStepIndex] = useState(0);
  const [created, setCreated] = useState<WizardCreated | null>(initial?.created ?? null);
  const [content, setContent] = useState<WizardContentInput>(initial?.content ?? EMPTY_CONTENT);
  const [documents, setDocuments] = useState<WizardDocItem[]>([]);
  const [notes, setNotes] = useState('');
  const [publish, setPublish] = useState<WizardPublish>(initial?.publish ?? EMPTY_PUBLISH);
  const [website, setWebsite] = useState<WizardWebsiteContent>(
    initial?.website ?? EMPTY_WEBSITE_CONTENT,
  );

  const updatePublish = (patch: Partial<WizardPublish>) =>
    setPublish((prev) => ({ ...prev, ...patch }));

  const modeRef = useRef<SubmitMode>('continue');
  const [pendingMode, setPendingMode] = useState<SubmitMode | null>(null);

  // Review workflow. `review` is read live off the (re)fetched hydration so the
  // banner, badge, and lock react to server state after a submit/approve/etc.
  const review: ReviewState | null = initial?.review ?? null;
  const locked = isContentLockedForReview(review);
  const reviewMutations = useReviewMutations(created);

  const branch = created?.branch ?? null;
  const resourceType = branch ? resourceTypeForBranch(branch) : 'opportunity_listing';
  const resourceId = created?.listingId ?? '';
  const { data: approvalStatus } = useResourceApprovalStatus(resourceType, resourceId, {
    enabled: isEdit && resourceId !== '',
  });
  const acknowledgeMutation = useAcknowledge();

  const awaitingPublish = isAwaitingPublish(review, approvalStatus ?? null);
  const awaitingUpdate = isAwaitingUpdate(review, approvalStatus ?? null);
  const awaiting = awaitingPublish || awaitingUpdate;
  const frozen = isEditingFrozen(review, awaiting);
  const showGoLive = canSubmitGoLive(review, awaitingPublish);
  const showSubmitUpdate = canSubmitUpdate(review, awaitingUpdate);
  const permitValid = isPermitValidForPublish(review);
  const canAcknowledge =
    !!approvalStatus?.hasPendingRequest && !!review?.isReviewer && !approvalStatus.canDecide;

  const footerSubmit = resolveFooterSubmit(review, awaiting && !review?.isReviewer);
  const [activityOpen, setActivityOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);

  const updateContent = <K extends keyof WizardContentInput>(
    key: K,
    value: WizardContentInput[K],
  ) => {
    setContent((prev) => ({ ...prev, [key]: value }));
  };

  const saveInformation = async (values: InformationValues) => {
    if (isEdit) {
      if (created === null) throw new Error('Listing not loaded yet.');
      await updateListing.mutateAsync({ created, values });
      showToast('success', 'Information updated');
      setStepIndex(1);
      return;
    }
    const result = await createListing.mutateAsync(values);
    const branch = branchFor(values.completionStatus);
    if (branch === null) throw new Error('Select a completion status before saving.');
    const next: WizardCreated =
      result.kind === 'listing'
        ? { branch, listingId: result.id }
        : { branch, opportunityId: result.id, leadId: result.leadId };
    setCreated(next);
    if (modeRef.current === 'draft') {
      showToast('success', 'Saved as draft');
      router.back();
      return;
    }
    showToast('success', 'Listing created');
    setStepIndex(1);
  };

  const informationForm = useInformationForm(async (values) => {
    try {
      await saveInformation(values);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Could not save the listing.');
      throw error;
    }
  }, initial?.information);

  const descriptionForm = useDescriptionForm(async (values) => {
    if (created === null) {
      showToast('error', 'Complete the information step first.');
      throw new Error('missing created ids');
    }
    try {
      const listingId = await saveContent.mutateAsync({ created, values });
      setCreated({ ...created, listingId });
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Could not save the content.');
      throw error;
    }
    setContent((prev) => ({ ...prev, title: values.title, description: values.description }));
    showToast('success', 'Listing content saved');
    setStepIndex(2);
  }, initial?.description);

  // Per-step dirty tracking — in edit an unchanged step is skipped (Next) with
  // no re-save; a changed step saves. Create always saves (no skip).
  // Deep-compare against the seeded values — TanStack's isDirty flags array
  // fields (e.g. ownerLanguages) as dirty on mount due to reference cloning.
  const infoDirty = useStore(
    informationForm.store,
    (s) => JSON.stringify(s.values) !== JSON.stringify(initial?.information),
  );
  const descDirty = useStore(
    descriptionForm.store,
    (s) => JSON.stringify(s.values) !== JSON.stringify(initial?.description),
  );
  const mediaDirty = useMemo(() => {
    const base = initial?.content ?? EMPTY_CONTENT;
    return (
      documents.length > 0 ||
      notes.trim() !== '' ||
      content.videoLink !== base.videoLink ||
      content.view360Link !== base.view360Link ||
      JSON.stringify(content.heroMedia) !== JSON.stringify(base.heroMedia) ||
      JSON.stringify(content.aboutImage1) !== JSON.stringify(base.aboutImage1) ||
      JSON.stringify(content.aboutImage2) !== JSON.stringify(base.aboutImage2)
    );
  }, [content, documents, notes, initial]);
  const portalsDirty = useMemo(() => {
    const bp = initial?.publish ?? EMPTY_PUBLISH;
    const bw = initial?.website ?? EMPTY_WEBSITE_CONTENT;
    const ba = initial?.content?.selectedAmenityIds ?? [];
    return (
      JSON.stringify(publish) !== JSON.stringify(bp) ||
      JSON.stringify(website) !== JSON.stringify(bw) ||
      JSON.stringify(content.selectedAmenityIds) !== JSON.stringify(ba)
    );
  }, [publish, website, content.selectedAmenityIds, initial]);

  const submitInformation = (mode: SubmitMode) => {
    modeRef.current = mode;
    setPendingMode(mode);
    informationForm
      .handleSubmit()
      .catch(() => {})
      .finally(() => setPendingMode(null));
  };

  const submitDescription = () => {
    setPendingMode('continue');
    descriptionForm
      .handleSubmit()
      .catch(() => {})
      .finally(() => setPendingMode(null));
  };

  const submitMedia = () => {
    if (created === null) {
      showToast('error', 'Complete the earlier steps first.');
      return;
    }
    setPendingMode('continue');
    saveMedia
      .mutateAsync({ created, content, documents, notes })
      .then((result) => {
        setContent((prev) => ({
          ...prev,
          heroMedia: result.heroMedia,
          aboutImage1: result.aboutImage1,
          aboutImage2: result.aboutImage2,
        }));
        setDocuments([]);
        showToast(
          'success',
          created.branch === 'secondary' ? 'Media & documents saved' : 'Media saved',
        );
        setStepIndex(3);
      })
      .catch((error: unknown) => {
        showToast('error', error instanceof Error ? error.message : 'Could not save media.');
      })
      .finally(() => setPendingMode(null));
  };

  const submitPortals = () => {
    if (created === null) {
      showToast('error', 'Complete the earlier steps first.');
      return;
    }
    setPendingMode('continue');
    saveAmenities
      .mutateAsync({ created, selectedAmenityIds: content.selectedAmenityIds })
      .then(() =>
        savePortals.mutateAsync({
          created,
          publish,
          website,
          content,
          selectedAmenityIds: content.selectedAmenityIds,
        }),
      )
      .then(() => {
        showToast('success', isEdit ? 'Listing updated' : 'Listing saved');
        router.back();
      })
      .catch((error: unknown) => {
        showToast('error', error instanceof Error ? error.message : 'Could not save the listing.');
      })
      .finally(() => setPendingMode(null));
  };

  // Agent terminal action: persist the Portals step, then submit for review.
  // The subsequent hydration refetch flips `review.status` and locks the form.
  const submitForReviewFlow = () => {
    if (created === null) {
      showToast('error', 'Complete the earlier steps first.');
      return;
    }
    setPendingMode('continue');
    saveAmenities
      .mutateAsync({ created, selectedAmenityIds: content.selectedAmenityIds })
      .then(() =>
        savePortals.mutateAsync({
          created,
          publish,
          website,
          content,
          selectedAmenityIds: content.selectedAmenityIds,
        }),
      )
      .then(() => reviewMutations.submitForReview.mutateAsync({ status: nextSubmitStatus(review) }))
      .then(() => {
        showToast('success', 'Submitted for review');
      })
      .catch((error: unknown) => {
        showToast('error', error instanceof Error ? error.message : 'Could not submit for review.');
      })
      .finally(() => setPendingMode(null));
  };

  const handleApprove = () => {
    reviewMutations.approve.mutate(undefined, {
      onSuccess: () => showToast('success', 'Content approved'),
      onError: (error) => showToast('error', error.message || 'Could not approve.'),
    });
  };

  const handleRequestChanges = (changeNotes: string) => {
    reviewMutations.requestChanges.mutate(
      { changeNotes },
      {
        onSuccess: () => {
          setRequestOpen(false);
          showToast('success', 'Changes requested');
        },
        onError: (error) => showToast('error', error.message || 'Could not request changes.'),
      },
    );
  };

  const handleSetPublished = (isPublished: boolean) => {
    reviewMutations.setPublished.mutate(
      { isPublished },
      {
        onSuccess: () =>
          showToast('success', isPublished ? 'Listing published' : 'Listing unpublished'),
        onError: (error) => showToast('error', error.message || 'Could not update publish state.'),
      },
    );
  };

  const handleSubmitGoLive = () => {
    if (!permitValid) {
      showToast('error', 'An approved Trakheesi permit is required to publish.');
      return;
    }
    reviewMutations.setPublished.mutate(
      { isPublished: true },
      {
        onSuccess: () => {
          queryClient
            .invalidateQueries({
              queryKey: ['approvals', 'resource-status', resourceType, resourceId],
            })
            .catch(() => {});
          showToast('success', 'Submitted for approval');
        },
        onError: (error) => showToast('error', error.message || 'Could not submit for approval.'),
      },
    );
  };

  const handleSubmitUpdate = () => {
    reviewMutations.submitForReview.mutate(
      { status: nextSubmitStatus(review) },
      {
        onSuccess: () => {
          queryClient
            .invalidateQueries({
              queryKey: ['approvals', 'resource-status', resourceType, resourceId],
            })
            .catch(() => {});
          showToast('success', 'Update submitted for review');
        },
        onError: (error) => showToast('error', error.message || 'Could not submit update.'),
      },
    );
  };

  const handleViewRequest = () => {
    const id = approvalStatus?.requestId;
    if (!id) return;
    const queue = awaitingUpdate ? 'listings-update' : 'listings-status';
    router.push({
      pathname: '/(app)/approvals/[queue]/[id]',
      params: { queue, id },
    });
  };

  const handleAcknowledge = () => {
    if (resourceId === '') return;
    acknowledgeMutation.mutate(
      { resourceType, resourceId },
      {
        onSuccess: () => showToast('success', 'Acknowledged'),
        onError: (error) => showToast('error', error.message || 'Could not acknowledge.'),
      },
    );
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-3 px-4 pb-2 pt-2">
        <BackButton />
        <Text className="flex-1 text-xl font-bold text-foreground" numberOfLines={1}>
          {isEdit ? 'Edit Listing' : 'Create Listing'}
        </Text>
        {isEdit ? (
          <Pressable
            onPress={() => setActivityOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="View activity"
            className="h-9 w-9 items-center justify-center rounded-full"
          >
            <Icon name="Clock" size={22} />
          </Pressable>
        ) : null}
      </View>
      <WizardStepper activeIndex={stepIndex} onStepPress={isEdit ? setStepIndex : undefined} />
      {isEdit && review && review.status !== 'draft' ? (
        <ReviewBanner
          review={review}
          locked={locked}
          approving={reviewMutations.approve.isPending || reviewMutations.requestChanges.isPending}
          publishing={reviewMutations.setPublished.isPending}
          onApprove={handleApprove}
          onRequestChanges={() => setRequestOpen(true)}
          onPublish={() => handleSetPublished(true)}
          onUnpublish={() => handleSetPublished(false)}
          canSubmitGoLive={showGoLive}
          submittingGoLive={reviewMutations.setPublished.isPending}
          onSubmitGoLive={handleSubmitGoLive}
          awaitingPublish={awaitingPublish && !review?.isReviewer}
          canSubmitUpdate={showSubmitUpdate}
          submittingUpdate={reviewMutations.submitForReview.isPending}
          onSubmitUpdate={handleSubmitUpdate}
          awaitingUpdate={awaitingUpdate && !review?.isReviewer}
          permitValid={permitValid}
          approvalRequestId={approvalStatus?.requestId ?? null}
          onViewRequest={handleViewRequest}
          canAcknowledge={canAcknowledge}
          acknowledging={acknowledgeMutation.isPending}
          onAcknowledge={handleAcknowledge}
        />
      ) : null}
      <View
        className="flex-1"
        pointerEvents={frozen ? 'none' : 'auto'}
        style={frozen ? { opacity: 0.55 } : undefined}
      >
        {stepIndex === 0 ? (
          <InformationStep
            form={informationForm}
            editMode={isEdit}
            initialCommunityName={initial?.meta?.communityName}
          />
        ) : null}
        {stepIndex === 1 ? <DescriptionStep form={descriptionForm} /> : null}
        {stepIndex === 2 ? (
          <MediaStep
            content={content}
            onContentChange={updateContent}
            showDocuments={created?.branch === 'secondary'}
            documents={documents}
            onDocumentsChange={setDocuments}
            notes={notes}
            onNotesChange={setNotes}
            leadId={created?.leadId}
          />
        ) : null}
        {stepIndex === 3 ? (
          <PortalsStep
            selectedAmenityIds={content.selectedAmenityIds}
            onSelectedChange={(ids) => updateContent('selectedAmenityIds', ids)}
            publish={publish}
            onPublishChange={updatePublish}
            website={website}
            onWebsiteChange={setWebsite}
            heroTitle={content.title}
            heroDescription={content.description}
          />
        ) : null}
      </View>
      <StepFooter
        stepIndex={stepIndex}
        isEdit={isEdit}
        pendingMode={pendingMode}
        dirty={{ info: infoDirty, desc: descDirty, media: mediaDirty, portals: portalsDirty }}
        onCancel={() => router.back()}
        onSaveDraftInfo={() => submitInformation('draft')}
        saveInfo={() => submitInformation('continue')}
        saveDesc={submitDescription}
        saveMedia={submitMedia}
        savePortals={submitPortals}
        goTo={setStepIndex}
        finish={() => router.back()}
        reviewSubmit={footerSubmit}
        onSubmitForReview={submitForReviewFlow}
      />
      <ActivitySheet
        created={created}
        visible={activityOpen}
        onClose={() => setActivityOpen(false)}
      />
      <RequestChangesDialog
        visible={requestOpen}
        submitting={reviewMutations.requestChanges.isPending}
        onSubmit={handleRequestChanges}
        onClose={() => setRequestOpen(false)}
      />
    </View>
  );
}

export interface ListingWizardProps {
  /** When set, the wizard runs in edit mode and prefills from this listing. */
  editListingId?: string;
  /** Branch of the listing being edited (required with `editListingId`). */
  editKind?: ListingBranch;
}

export function ListingWizard({ editListingId, editKind }: Readonly<ListingWizardProps>) {
  const insets = useSafeAreaInsets();
  const isEdit = editListingId !== undefined && editKind !== undefined;
  const hydration = useListingEditHydration(editListingId, editKind ?? 'secondary');

  // Edit mode waits for the server prefill so the forms mount already seeded.
  if (isEdit && (hydration.isLoading || !hydration.data)) {
    return (
      <View
        className="flex-1 items-center justify-center bg-background"
        style={{ paddingTop: insets.top }}
      >
        {hydration.isError ? (
          <Text className="px-6 text-center text-base font-semibold text-destructive">
            {hydration.error?.message ?? 'Could not load the listing.'}
          </Text>
        ) : (
          <ActivityIndicator />
        )}
      </View>
    );
  }

  // `key` forces a fresh body per listing so its seeded initial state is applied.
  return (
    <WizardBody
      key={editListingId ?? 'create'}
      isEdit={isEdit}
      initial={isEdit ? hydration.data : undefined}
    />
  );
}
