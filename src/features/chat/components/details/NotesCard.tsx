import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import {
  useCreateLeadNote,
  useDeleteLeadNote,
  useLeadNotes,
  useUpdateLeadNote,
} from '@/features/leads/hooks/use-lead-notes';
import type { LeadNote } from '@/features/leads/types';
import { PERMISSIONS, useRequirePermission } from '@/lib/rbac';
import { useThemeColor } from '@theme';

function NoteEditForm({
  note,
  leadId,
  onDone,
}: Readonly<{ note: LeadNote; leadId: string; onDone: () => void }>) {
  const foreground = useThemeColor('--foreground');
  const border = useThemeColor('--border');
  const update = useUpdateLeadNote(leadId);
  const [draft, setDraft] = useState(note.content);

  const onSave = (): void => {
    const content = draft.trim();
    if (content === '' || content === note.content.trim()) return;
    update.mutate(
      { noteId: note.id, content },
      {
        onSuccess: onDone,
        onError: () => Alert.alert('Update failed', 'Could not update note. Please try again.'),
      },
    );
  };

  return (
    <View className="gap-2">
      <TextInput
        value={draft}
        onChangeText={setDraft}
        multiline
        style={{
          minHeight: 60,
          color: foreground,
          borderWidth: 1,
          borderColor: border,
          borderRadius: 8,
          padding: 8,
        }}
      />
      <View className="flex-row justify-end gap-2">
        <Pressable
          onPress={onDone}
          className="rounded-lg border border-border px-3 py-1.5 active:opacity-70"
        >
          <Text className="text-sm">Cancel</Text>
        </Pressable>
        <Pressable onPress={onSave} className="rounded-lg bg-primary px-3 py-1.5 active:opacity-80">
          <Text className="text-sm text-primary-foreground">Save</Text>
        </Pressable>
      </View>
    </View>
  );
}

function NoteViewRow({
  note,
  canEdit,
  onEdit,
  onDelete,
}: Readonly<{
  note: LeadNote;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}>) {
  const mutedFg = useThemeColor('--muted-foreground');
  const destructive = useThemeColor('--destructive');

  return (
    <>
      <Text className="text-sm">{note.content}</Text>
      <View className="mt-1.5 flex-row items-center justify-between">
        <Text className="text-xs text-muted-foreground">{note.author?.name ?? ''}</Text>
        {canEdit && note.canModify !== false ? (
          <View className="flex-row gap-1">
            <Pressable
              onPress={onEdit}
              hitSlop={8}
              accessibilityLabel="Edit note"
              className="h-8 w-8 items-center justify-center rounded-md active:bg-muted-foreground/10"
            >
              <Icon name="Pencil" size={14} color={mutedFg} />
            </Pressable>
            <Pressable
              onPress={onDelete}
              hitSlop={8}
              accessibilityLabel="Delete note"
              className="h-8 w-8 items-center justify-center rounded-md active:bg-muted-foreground/10"
            >
              <Icon name="Trash2" size={14} color={destructive} />
            </Pressable>
          </View>
        ) : null}
      </View>
    </>
  );
}

function NoteRow({
  leadId,
  note,
  canEdit,
}: Readonly<{ leadId: string; note: LeadNote; canEdit: boolean }>) {
  const del = useDeleteLeadNote(leadId);
  const [editing, setEditing] = useState(false);

  const onDelete = (): void =>
    Alert.alert('Delete note', 'Delete this note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          del.mutate(
            { noteId: note.id },
            {
              onError: () =>
                Alert.alert('Delete failed', 'Could not delete note. Please try again.'),
            },
          ),
      },
    ]);

  return (
    <View className="rounded-lg border border-border bg-background p-2.5">
      {editing ? (
        <NoteEditForm note={note} leadId={leadId} onDone={() => setEditing(false)} />
      ) : (
        <NoteViewRow
          note={note}
          canEdit={canEdit}
          onEdit={() => setEditing(true)}
          onDelete={onDelete}
        />
      )}
    </View>
  );
}

export function NotesCard({ leadId }: Readonly<{ leadId: string }>) {
  const foreground = useThemeColor('--foreground');
  const border = useThemeColor('--border');
  const canEdit = useRequirePermission(PERMISSIONS.LEADS_UPDATE) === 'allowed';
  const { data: notes = [], isLoading } = useLeadNotes(leadId);
  const create = useCreateLeadNote(leadId);
  const [draft, setDraft] = useState('');

  return (
    <View className="gap-2.5 px-4 py-3">
      <Text className="text-base font-semibold">Notes</Text>
      {canEdit ? (
        <View className="gap-2">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            multiline
            placeholder="Write a note about this contact…"
            placeholderTextColor={border}
            style={{
              minHeight: 60,
              color: foreground,
              borderWidth: 1,
              borderColor: border,
              borderRadius: 8,
              padding: 8,
            }}
          />
          <Pressable
            onPress={() => {
              const content = draft.trim();
              if (content === '') return;
              create.mutate(content, {
                onSuccess: () => setDraft(''),
                onError: () => Alert.alert('Add failed', 'Could not add note. Please try again.'),
              });
            }}
            disabled={draft.trim() === '' || create.isPending}
            className="self-end rounded-lg bg-primary px-4 py-2 active:opacity-80"
            style={{ opacity: draft.trim() === '' ? 0.5 : 1 }}
          >
            <Text className="text-sm font-medium text-primary-foreground">Add Note</Text>
          </Pressable>
        </View>
      ) : null}

      {isLoading ? (
        <Text className="text-sm text-muted-foreground">Loading notes…</Text>
      ) : notes.length === 0 ? (
        <Text className="text-sm text-muted-foreground">No notes yet.</Text>
      ) : (
        <View className="gap-1.5">
          {notes.map((note) => (
            <NoteRow key={note.id} leadId={leadId} note={note} canEdit={canEdit} />
          ))}
        </View>
      )}
    </View>
  );
}
