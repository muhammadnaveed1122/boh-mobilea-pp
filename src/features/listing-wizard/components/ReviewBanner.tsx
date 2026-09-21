import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/atoms/Avatar';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useThemeColor } from '@theme';
import { normalizeRgb } from '../ui-color';
import {
  canReviewNow,
  permitBadge,
  statusBadgeVariant,
  statusHeadline,
  statusLabel,
  statusTimestamp,
  type ReviewPerson,
  type ReviewState,
} from '../review-state';

function initialsOf(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : format(date, 'd MMM yyyy, h:mm a');
}

/** Avatar + name + role, with an optional caption line (label / timestamp). */
function PersonRow({ person, caption }: Readonly<{ person: ReviewPerson; caption?: string }>) {
  const sub = caption ?? person.role ?? undefined;
  return (
    <View className="flex-row items-center gap-2.5">
      <Avatar alt={person.name ?? 'User'} className="h-9 w-9">
        {person.avatarUrl ? <AvatarImage source={{ uri: person.avatarUrl }} /> : null}
        <AvatarFallback>
          <Text>{initialsOf(person.name)}</Text>
        </AvatarFallback>
      </Avatar>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
          {person.name ?? 'Unknown'}
        </Text>
        {sub ? (
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Identity rows: creator, the agent, and — once live — whoever actually published.
 *
 * The publish timestamp hangs off the publisher row, never the creator's: they are usually
 * different people (an agent creates, an approver publishes). `publishedBy` is the same
 * history-derived field the web listing screens show.
 */
function PeopleRows({ review }: Readonly<{ review: ReviewState }>) {
  const timestamp = statusTimestamp(review);
  const publisher: ReviewPerson | null = review.publishedBy ? { name: review.publishedBy } : null;
  const isPublishStamp = timestamp?.label === 'Published';
  if (!review.createdBy && !review.agentInfo && !publisher) return null;

  const submitterCaption =
    timestamp && !isPublishStamp
      ? `${timestamp.label}: ${formatWhen(timestamp.iso)}`
      : (review.createdBy?.role ?? undefined);
  const publisherCaption =
    timestamp && isPublishStamp ? `Published: ${formatWhen(timestamp.iso)}` : 'Published by';

  return (
    <View className="gap-3 border-t border-border pt-3">
      {review.createdBy ? <PersonRow person={review.createdBy} caption={submitterCaption} /> : null}
      {review.agentInfo ? <PersonRow person={review.agentInfo} caption="Assigned agent" /> : null}
      {publisher ? <PersonRow person={publisher} caption={publisherCaption} /> : null}
    </View>
  );
}

/** Change-notes callout + editing-locked notice. */
function ReviewNotices({
  review,
  locked,
  warning,
  info,
}: Readonly<{ review: ReviewState; locked: boolean; warning: string; info: string }>) {
  const showChangeNotes = !!review.changeNotes && review.changeNotes.trim() !== '';
  return (
    <>
      {showChangeNotes ? (
        <View className="flex-row gap-2 rounded-xl bg-warning/15 p-3 dark:bg-warning/25">
          <Icon name="TriangleAlert" size={18} color={warning} />
          <View className="flex-1 gap-0.5">
            <Text className="text-sm font-semibold text-warning">Changes requested</Text>
            <Text className="text-sm text-foreground">{review.changeNotes}</Text>
          </View>
        </View>
      ) : null}
      {locked ? (
        <View className="flex-row items-center gap-2 rounded-xl bg-info/15 p-3 dark:bg-info/20">
          <Icon name="Lock" size={18} color={info} />
          <Text className="flex-1 text-sm text-foreground">
            Editing is locked while this listing is under review. A manager must request changes
            before you can edit again.
          </Text>
        </View>
      ) : null}
    </>
  );
}

/** Reviewer decision actions (approve / request changes / publish / unpublish). */
function ReviewActions({
  review,
  approving,
  publishing,
  fg,
  primaryFg,
  onApprove,
  onRequestChanges,
  onPublish,
  onUnpublish,
}: Readonly<{
  review: ReviewState;
  approving: boolean;
  publishing: boolean;
  fg: string;
  primaryFg: string;
  onApprove: () => void;
  onRequestChanges: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
}>) {
  const showReviewerActions = canReviewNow(review);
  const canPublish = review.isReviewer && review.status === 'approved';
  const canUnpublish = review.isReviewer && review.status === 'active' && review.isPublished;
  if (!showReviewerActions && !canPublish && !canUnpublish) return null;

  return (
    <View className="gap-2 border-t border-border pt-3">
      {showReviewerActions ? (
        <View className="flex-row gap-3">
          <Button
            className="flex-1"
            onPress={onApprove}
            loading={approving}
            accessibilityLabel="Approve listing content"
          >
            <Icon name="Check" size={18} color={primaryFg} />
            <Text>Approve</Text>
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onPress={onRequestChanges}
            disabled={approving || publishing}
            accessibilityLabel="Request changes to this listing"
          >
            <Icon name="MessageSquareWarning" size={18} color={fg} />
            <Text>Request Changes</Text>
          </Button>
        </View>
      ) : null}
      {canPublish ? (
        <Button onPress={onPublish} loading={publishing} accessibilityLabel="Publish listing">
          <Icon name="Rocket" size={18} color={primaryFg} />
          <Text>Publish</Text>
        </Button>
      ) : null}
      {canUnpublish ? (
        <Button
          variant="outline"
          onPress={onUnpublish}
          loading={publishing}
          accessibilityLabel="Unpublish listing"
        >
          <Icon name="EyeOff" size={18} color={fg} />
          <Text>Unpublish</Text>
        </Button>
      ) : null}
    </View>
  );
}

/** Agent go-live submit + awaiting-publish notice (with view-request + acknowledge). */
function AgentPublishSection({
  canSubmitGoLive,
  submittingGoLive,
  onSubmitGoLive,
  awaitingPublish,
  permitValid,
  approvalRequestId,
  onViewRequest,
  canAcknowledge,
  acknowledging,
  onAcknowledge,
  info,
  fg,
  primaryFg,
}: Readonly<{
  canSubmitGoLive: boolean;
  submittingGoLive: boolean;
  onSubmitGoLive?: () => void;
  awaitingPublish: boolean;
  permitValid: boolean;
  approvalRequestId: string | null;
  onViewRequest?: () => void;
  canAcknowledge: boolean;
  acknowledging: boolean;
  onAcknowledge?: () => void;
  info: string;
  fg: string;
  primaryFg: string;
}>) {
  if (!canSubmitGoLive && !awaitingPublish) return null;

  return (
    <View className="gap-2 border-t border-border pt-3">
      {canSubmitGoLive ? (
        <>
          <Button
            onPress={onSubmitGoLive}
            loading={submittingGoLive}
            disabled={!permitValid || submittingGoLive}
            accessibilityLabel="Submit listing for publish approval"
          >
            <Icon name="Rocket" size={18} color={primaryFg} />
            <Text>Submit for Approval</Text>
          </Button>
          {!permitValid ? (
            <Text className="text-xs text-muted-foreground">
              An approved Trakheesi permit is required to publish.
            </Text>
          ) : null}
        </>
      ) : null}

      {awaitingPublish ? (
        <View className="gap-2 rounded-xl bg-info/15 p-3 dark:bg-info/20">
          <View className="flex-row gap-2">
            <Icon name="Clock" size={18} color={info} />
            <Text className="flex-1 text-sm text-foreground">
              Submitted for publish — awaiting an approver’s decision.
            </Text>
          </View>
          {approvalRequestId && onViewRequest ? (
            <Button
              variant="outline"
              onPress={onViewRequest}
              accessibilityLabel="View the approval request"
            >
              <Icon name="ExternalLink" size={18} color={fg} />
              <Text>View Request</Text>
            </Button>
          ) : null}
          {canAcknowledge && onAcknowledge ? (
            <Button
              variant="outline"
              onPress={onAcknowledge}
              loading={acknowledging}
              accessibilityLabel="Acknowledge this request"
            >
              <Icon name="Check" size={18} color={fg} />
              <Text>Acknowledge</Text>
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Agent content-update submit + awaiting-update notice (with view-request + acknowledge). */
function AgentUpdateSection({
  canSubmitUpdate,
  submittingUpdate,
  onSubmitUpdate,
  awaitingUpdate,
  approvalRequestId,
  onViewRequest,
  canAcknowledge,
  acknowledging,
  onAcknowledge,
  info,
  fg,
  primaryFg,
}: Readonly<{
  canSubmitUpdate: boolean;
  submittingUpdate: boolean;
  onSubmitUpdate?: () => void;
  awaitingUpdate: boolean;
  approvalRequestId: string | null;
  onViewRequest?: () => void;
  canAcknowledge: boolean;
  acknowledging: boolean;
  onAcknowledge?: () => void;
  info: string;
  fg: string;
  primaryFg: string;
}>) {
  if (!canSubmitUpdate && !awaitingUpdate) return null;

  return (
    <View className="gap-2 border-t border-border pt-3">
      {canSubmitUpdate ? (
        <Button
          onPress={onSubmitUpdate}
          loading={submittingUpdate}
          disabled={submittingUpdate}
          accessibilityLabel="Submit content update for review"
        >
          <Icon name="Send" size={18} color={primaryFg} />
          <Text>Submit Update for Review</Text>
        </Button>
      ) : null}

      {awaitingUpdate ? (
        <View className="gap-2 rounded-xl bg-info/15 p-3 dark:bg-info/20">
          <View className="flex-row gap-2">
            <Icon name="Clock" size={18} color={info} />
            <Text className="flex-1 text-sm text-foreground">
              Your content update is awaiting review — the listing stays published until the
              reviewer approves the update.
            </Text>
          </View>
          {approvalRequestId && onViewRequest ? (
            <Button
              variant="outline"
              onPress={onViewRequest}
              accessibilityLabel="View the approval request"
            >
              <Icon name="ExternalLink" size={18} color={fg} />
              <Text>View Request</Text>
            </Button>
          ) : null}
          {canAcknowledge && onAcknowledge ? (
            <Button
              variant="outline"
              onPress={onAcknowledge}
              loading={acknowledging}
              accessibilityLabel="Acknowledge this request"
            >
              <Icon name="Check" size={18} color={fg} />
              <Text>Acknowledge</Text>
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Rich review banner shown under the stepper in edit mode. Surfaces the status
 * headline + description, permit validity, the manager's change notes, an
 * editing-locked notice for agents under review, the submitter / assigned-agent
 * identity rows, and — for reviewers — the Approve / Request Changes / Publish
 * decision actions. Mirrors the web wizard's review card.
 */
export function ReviewBanner({
  review,
  locked,
  approving,
  publishing,
  onApprove,
  onRequestChanges,
  onPublish,
  onUnpublish,
  canSubmitGoLive = false,
  submittingGoLive = false,
  onSubmitGoLive,
  awaitingPublish = false,
  permitValid = false,
  approvalRequestId = null,
  onViewRequest,
  canAcknowledge = false,
  acknowledging = false,
  onAcknowledge,
  canSubmitUpdate = false,
  submittingUpdate = false,
  onSubmitUpdate,
  awaitingUpdate = false,
}: Readonly<{
  review: ReviewState;
  locked: boolean;
  approving: boolean;
  publishing: boolean;
  onApprove: () => void;
  onRequestChanges: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  canSubmitGoLive?: boolean;
  submittingGoLive?: boolean;
  onSubmitGoLive?: () => void;
  awaitingPublish?: boolean;
  permitValid?: boolean;
  approvalRequestId?: string | null;
  onViewRequest?: () => void;
  canAcknowledge?: boolean;
  acknowledging?: boolean;
  onAcknowledge?: () => void;
  canSubmitUpdate?: boolean;
  submittingUpdate?: boolean;
  onSubmitUpdate?: () => void;
  awaitingUpdate?: boolean;
}>) {
  const warning = normalizeRgb(useThemeColor('--warning'));
  const info = normalizeRgb(useThemeColor('--info'));
  const fg = normalizeRgb(useThemeColor('--foreground'));
  const primaryFg = normalizeRgb(useThemeColor('--primary-foreground'));

  const [expanded, setExpanded] = useState(true);
  const headline = statusHeadline(review);
  const permit = permitBadge(review);

  return (
    <View className="mx-4 mb-2 gap-3 rounded-2xl border border-border bg-card p-4">
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Collapse review details' : 'Expand review details'}
        className="flex-row items-start gap-3"
      >
        <View className="flex-1 gap-0.5">
          <Text className="text-lg font-extrabold text-foreground">{headline.title}</Text>
          {expanded ? (
            <Text className="text-sm text-muted-foreground">{headline.subtitle}</Text>
          ) : null}
        </View>
        <View className="items-end gap-1.5">
          <Badge variant={statusBadgeVariant(review.status)}>
            <Text>{statusLabel(review.status)}</Text>
          </Badge>
          {permit ? (
            <Badge variant={permit.variant}>
              <Text>{permit.label}</Text>
            </Badge>
          ) : null}
        </View>
        <Icon name={expanded ? 'ChevronUp' : 'ChevronDown'} size={20} color={fg} />
      </Pressable>

      {expanded ? (
        <>
          <ReviewNotices review={review} locked={locked} warning={warning} info={info} />

          <PeopleRows review={review} />

          <ReviewActions
            review={review}
            approving={approving}
            publishing={publishing}
            fg={fg}
            primaryFg={primaryFg}
            onApprove={onApprove}
            onRequestChanges={onRequestChanges}
            onPublish={onPublish}
            onUnpublish={onUnpublish}
          />

          <AgentPublishSection
            canSubmitGoLive={canSubmitGoLive}
            submittingGoLive={submittingGoLive}
            onSubmitGoLive={onSubmitGoLive}
            awaitingPublish={awaitingPublish}
            permitValid={permitValid}
            approvalRequestId={approvalRequestId}
            onViewRequest={onViewRequest}
            canAcknowledge={canAcknowledge}
            acknowledging={acknowledging}
            onAcknowledge={onAcknowledge}
            info={info}
            fg={fg}
            primaryFg={primaryFg}
          />

          <AgentUpdateSection
            canSubmitUpdate={canSubmitUpdate}
            submittingUpdate={submittingUpdate}
            onSubmitUpdate={onSubmitUpdate}
            awaitingUpdate={awaitingUpdate}
            approvalRequestId={approvalRequestId}
            onViewRequest={onViewRequest}
            canAcknowledge={canAcknowledge}
            acknowledging={acknowledging}
            onAcknowledge={onAcknowledge}
            info={info}
            fg={fg}
            primaryFg={primaryFg}
          />
        </>
      ) : null}
    </View>
  );
}
