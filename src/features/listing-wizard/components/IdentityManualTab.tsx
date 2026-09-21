import { useState } from 'react';
import { Image, Linking, Pressable, View } from 'react-native';

import { Button } from '@/components/atoms/Button';
import { Icon, type IconName } from '@/components/atoms/Icon';
import { Label } from '@/components/atoms/Label';
import { Text } from '@/components/atoms/Text';
import { Textarea } from '@/components/atoms/Textarea';
import { showToast } from '@/lib/toast/toast.store';
import { cn } from '@/lib/utils';
import { useThemeColor } from '@theme';

import { useIdentityVerification } from '../hooks/use-identity-verification';
import { pickSingleDocument } from '../media/pickers';
import type { WizardDocItem } from '../media/types';
import type { DocVerifyStatus, IdentityDoc, LeadDocument } from '../services';

function isImageFile(mime: string, name: string): boolean {
  return mime.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(name);
}

function docIcon(mime: string, name: string): IconName {
  if (isImageFile(mime, name)) return 'Image';
  if (mime === 'application/pdf' || /\.pdf$/i.test(name)) return 'FileText';
  return 'File';
}

/** Seed an IdentityDoc from a server LeadDocument when it represents a real manual upload
 *  (has a file). A synthetic link doc (LINK method, empty fileUrl) is not a manual doc. */
function seedManualDoc(latest: LeadDocument | null): IdentityDoc | null {
  if (latest === null) return null;
  if (latest.verificationMethod === 'LINK' && latest.fileUrl === '') return null;
  return {
    id: latest.id,
    fileName: latest.fileName,
    fileUrl: latest.fileUrl,
    mimeType: latest.mimeType ?? '',
  };
}

export interface IdentityManualTabProps {
  leadId: string;
  latestDoc: LeadDocument | null;
  isLinkVerified: boolean;
  onRefetch: () => Promise<void>;
}

interface ManualTabState {
  pendingFile: WizardDocItem | null;
  uploaded: IdentityDoc | null;
  notes: string;
  status: DocVerifyStatus;
}

interface ManualTabMethods {
  pick: () => Promise<void>;
  openDoc: () => Promise<void>;
  canMark: (next: 'VERIFIED' | 'REJECTED') => boolean;
  mark: (next: 'VERIFIED' | 'REJECTED') => Promise<void>;
  setNotes: (n: string) => void;
  onNotesBlur: () => void;
}

interface DocPreviewProps {
  displayName: string | undefined;
  displayMime: string;
  previewUri: string | undefined;
  status: DocVerifyStatus;
  colors: { mutedFg: string; brand: string; destructive: string };
  openDoc: () => Promise<void>;
}

function DocPreview({
  displayName,
  displayMime,
  previewUri,
  status,
  colors,
  openDoc,
}: Readonly<DocPreviewProps>) {
  const { mutedFg, brand } = colors;
  const statusMeta: Record<DocVerifyStatus, { label: string; icon: IconName; color: string }> = {
    PENDING: { label: 'Pending', icon: 'Clock', color: mutedFg },
    VERIFIED: { label: 'Verified', icon: 'CircleCheck', color: brand },
    REJECTED: { label: 'Rejected', icon: 'CircleX', color: colors.destructive },
  };
  const sMeta = statusMeta[status];

  return (
    <Pressable
      onPress={() => void openDoc()}
      accessibilityRole="button"
      accessibilityLabel="Open document"
      className="flex-row items-center gap-3 rounded-lg border border-border bg-card p-2.5 active:opacity-80"
    >
      <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-md bg-muted">
        {previewUri !== undefined && isImageFile(displayMime, displayName ?? '') ? (
          <Image source={{ uri: previewUri }} style={{ width: '100%', height: '100%' }} />
        ) : (
          <Icon name={docIcon(displayMime, displayName ?? '')} size={20} color={mutedFg} />
        )}
      </View>
      <View className="flex-1">
        <Text className="text-sm text-foreground" numberOfLines={1}>
          {displayName}
        </Text>
        <View className="mt-1 flex-row items-center gap-1">
          <Icon name={sMeta.icon} size={12} color={sMeta.color} />
          <Text className="text-xs" style={{ color: sMeta.color }}>
            {sMeta.label}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

interface DocActionsProps {
  status: DocVerifyStatus;
  isBusy: boolean;
  colors: { brand: string; brandFg: string; destructive: string };
  mark: (next: 'VERIFIED' | 'REJECTED') => Promise<void>;
}

function DocActions({ status, isBusy, colors, mark }: Readonly<DocActionsProps>) {
  const { brand, brandFg, destructive } = colors;

  return (
    <View className="flex-row gap-3">
      <Button
        variant="outline"
        className={cn('flex-1 border-brand', status === 'VERIFIED' && 'bg-brand')}
        disabled={isBusy || status === 'VERIFIED'}
        onPress={() => void mark('VERIFIED')}
      >
        <Text style={{ color: status === 'VERIFIED' ? brandFg : brand }}>
          {status === 'VERIFIED' ? 'Verified' : 'Mark Verified'}
        </Text>
      </Button>
      <Button
        variant="outline"
        className={cn('flex-1 border-destructive', status === 'REJECTED' && 'bg-destructive')}
        disabled={isBusy || status === 'REJECTED'}
        onPress={() => void mark('REJECTED')}
      >
        <Text style={{ color: status === 'REJECTED' ? '#ffffff' : destructive }}>
          {status === 'REJECTED' ? 'Rejected' : 'Mark Rejected'}
        </Text>
      </Button>
    </View>
  );
}

function ManualTabContent({
  state,
  methods,
  colors,
  isBusy,
}: Readonly<{
  state: ManualTabState;
  methods: ManualTabMethods;
  colors: { brand: string; brandFg: string; destructive: string; mutedFg: string };
  isBusy: boolean;
}>) {
  const { pendingFile, uploaded, notes, status } = state;
  const { pick, openDoc, mark, setNotes, onNotesBlur } = methods;
  const { brand, brandFg, destructive, mutedFg } = colors;

  const displayName = pendingFile?.name ?? uploaded?.fileName;
  const displayMime = pendingFile?.mimeType ?? uploaded?.mimeType ?? '';
  const previewUri =
    uploaded?.fileUrl !== undefined && uploaded.fileUrl !== ''
      ? uploaded.fileUrl
      : pendingFile?.uri;
  const hasFile = pendingFile !== null || uploaded !== null;

  return (
    <View className="gap-3">
      {hasFile ? (
        <DocPreview
          displayName={displayName}
          displayMime={displayMime}
          previewUri={previewUri}
          status={status}
          colors={{ mutedFg, brand, destructive }}
          openDoc={openDoc}
        />
      ) : (
        <Pressable
          onPress={() => void pick()}
          disabled={isBusy}
          accessibilityRole="button"
          accessibilityLabel="Add Emirates ID or Passport"
          className="flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background py-6 active:opacity-80"
        >
          <Icon name="Plus" size={18} color={brand} />
          <Text className="text-sm font-medium text-foreground">Add Emirates ID / Passport</Text>
        </Pressable>
      )}

      {hasFile ? (
        <DocActions
          status={status}
          isBusy={isBusy}
          colors={{ brand, brandFg, destructive }}
          mark={mark}
        />
      ) : null}

      <View className="gap-1.5">
        <Label>
          Internal Notes
          {status === 'REJECTED' ? <Text className="text-destructive"> *</Text> : null}
        </Label>
        <Textarea
          value={notes}
          onChangeText={setNotes}
          onBlur={onNotesBlur}
          placeholder="Enter any additional notes here..."
          numberOfLines={3}
          editable={!isBusy}
        />
      </View>
    </View>
  );
}

export function IdentityManualTab({
  leadId,
  latestDoc,
  isLinkVerified,
  onRefetch,
}: Readonly<IdentityManualTabProps>) {
  const brand = useThemeColor('--brand');
  const brandFg = useThemeColor('--brand-foreground');
  const destructive = useThemeColor('--destructive');
  const mutedFg = useThemeColor('--muted-foreground');
  const { uploadAndVerify, updateNotes, isBusy } = useIdentityVerification();

  const seeded = seedManualDoc(latestDoc);
  const seededStatus: DocVerifyStatus =
    seeded !== null && latestDoc ? latestDoc.verificationStatus : 'PENDING';

  const [pendingFile, setPendingFile] = useState<WizardDocItem | null>(null);
  const [uploaded, setUploaded] = useState<IdentityDoc | null>(seeded);
  const [notes, setNotes] = useState(latestDoc?.notes ?? '');
  const [status, setStatus] = useState<DocVerifyStatus>(seededStatus);

  const hasFile = pendingFile !== null || uploaded !== null;
  const previewUri =
    uploaded?.fileUrl !== undefined && uploaded.fileUrl !== ''
      ? uploaded.fileUrl
      : pendingFile?.uri;

  if (isLinkVerified) {
    return (
      <View className="flex-row items-center gap-1.5 rounded-xl border border-border bg-card p-3">
        <Icon name="ShieldCheck" size={16} color={brand} />
        <Text className="flex-1 text-xs text-muted-foreground">
          Already verified via verification link. To verify manually instead, reset it from the Send
          Verification Link tab.
        </Text>
      </View>
    );
  }

  const pick = async () => {
    const f = await pickSingleDocument();
    if (f === null) return;
    setPendingFile(f);
    setUploaded(null);
    setStatus('PENDING');
  };

  const openDoc = async () => {
    if (previewUri === undefined) return;
    try {
      const ok = await Linking.canOpenURL(previewUri);
      if (!ok) {
        showToast('error', 'Cannot open this document.');
        return;
      }
      await Linking.openURL(previewUri);
    } catch {
      showToast('error', 'Cannot open this document.');
    }
  };

  const canMark = (next: 'VERIFIED' | 'REJECTED'): boolean => {
    if (!hasFile) return false;
    if (next === 'REJECTED' && notes.trim() === '') {
      showToast('error', 'Add internal notes before rejecting.');
      return false;
    }
    return true;
  };

  const performUpload = async (next: 'VERIFIED' | 'REJECTED') => {
    const fileForUpload: WizardDocItem = pendingFile ?? {
      uri: uploaded?.fileUrl ?? '',
      name: uploaded?.fileName ?? 'document',
      mimeType: uploaded?.mimeType ?? 'application/octet-stream',
    };
    const doc = await uploadAndVerify({
      leadId,
      file: fileForUpload,
      existingId: uploaded?.id,
      status: next,
      notes,
    });
    if (doc !== null) {
      setUploaded(doc);
      setPendingFile(null);
    }
    setStatus(next);
    await onRefetch();
    const msg = next === 'VERIFIED' ? 'Identity verified' : 'Identity marked rejected';
    showToast('success', msg);
  };

  const mark = async (next: 'VERIFIED' | 'REJECTED') => {
    if (!canMark(next)) return;
    try {
      await performUpload(next);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Could not update identity.');
    }
  };

  const onNotesBlur = () => {
    if (uploaded !== null) void updateNotes(leadId, uploaded.id, notes);
  };

  return (
    <ManualTabContent
      state={{ pendingFile, uploaded, notes, status }}
      methods={{
        pick,
        openDoc,
        canMark,
        mark,
        setNotes,
        onNotesBlur,
      }}
      colors={{ brand, brandFg, destructive, mutedFg }}
      isBusy={isBusy}
    />
  );
}
