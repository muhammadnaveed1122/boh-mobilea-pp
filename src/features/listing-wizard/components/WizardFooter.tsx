import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/atoms/Button';
import { Text } from '@/components/atoms/Text';

type SubmitMode = 'draft' | 'continue';

/**
 * Action bar for the create wizard. A single primary CTA gets its own full-width row so its
 * label never truncates; the subordinate actions sit on a second row. Only the in-flight
 * action shows a spinner; all buttons lock while submitting.
 *
 * Step 1 uses the defaults (Cancel + Save as Draft + "Create & Continue"). Later steps pass
 * `onBack` (the left button becomes "Back"), a custom `primaryLabel`, and `showSaveDraft={false}`.
 */
export function WizardFooter({
  onCancel,
  onSaveDraft,
  onCreate,
  submittingMode,
  primaryLabel = 'Create & Continue',
  onBack,
  showSaveDraft = true,
  hidePrimary = false,
}: Readonly<{
  onCancel: () => void;
  onSaveDraft: () => void;
  onCreate: () => void;
  submittingMode: SubmitMode | null;
  primaryLabel?: string;
  onBack?: () => void;
  showSaveDraft?: boolean;
  /** Hide the primary CTA (e.g. form locked under review, or reviewer-only step). */
  hidePrimary?: boolean;
}>) {
  const insets = useSafeAreaInsets();
  const isSubmitting = submittingMode !== null;

  return (
    <View
      className="gap-2.5 border-t border-border bg-background px-4 pt-3"
      style={{ paddingBottom: 12 + insets.bottom }}
    >
      {hidePrimary ? null : (
        <Button
          size="lg"
          onPress={onCreate}
          disabled={isSubmitting}
          loading={submittingMode === 'continue'}
        >
          <Text>{primaryLabel}</Text>
        </Button>
      )}

      <View className="flex-row gap-3">
        <Button
          variant="ghost"
          className="flex-1"
          onPress={onBack ?? onCancel}
          disabled={isSubmitting}
        >
          <Text>{onBack ? 'Back' : 'Cancel'}</Text>
        </Button>
        {showSaveDraft && (
          <Button
            variant="outline"
            className="flex-1"
            onPress={onSaveDraft}
            disabled={isSubmitting}
            loading={submittingMode === 'draft'}
          >
            <Text>Save as Draft</Text>
          </Button>
        )}
      </View>
    </View>
  );
}
