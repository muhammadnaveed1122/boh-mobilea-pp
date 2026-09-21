import { ScrollView, View } from 'react-native';

import { Input } from '@/components/atoms/Input';
import { Label } from '@/components/atoms/Label';
import { Textarea } from '@/components/atoms/Textarea';

import type { WizardContentInput } from '../../hooks/use-save-media';
import type { WizardDocItem } from '../../media/types';
import { DocumentPickerField } from '../DocumentPickerField';
import { IdentitySection } from '../IdentitySection';
import { MediaGallery } from '../MediaGallery';
import { SingleImageField } from '../SingleImageField';
import { WizardCard } from '../WizardCard';

export interface MediaStepProps {
  content: WizardContentInput;
  onContentChange: <K extends keyof WizardContentInput>(
    key: K,
    value: WizardContentInput[K],
  ) => void;
  showDocuments: boolean;
  documents: WizardDocItem[];
  onDocumentsChange: (items: WizardDocItem[]) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  leadId?: string;
}

export function MediaStep({
  content,
  onContentChange,
  showDocuments,
  documents,
  onDocumentsChange,
  notes,
  onNotesChange,
  leadId,
}: Readonly<MediaStepProps>) {
  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View className="gap-4">
        <WizardCard
          icon="Images"
          title="Images"
          description="Hero images and videos shown at the top of the listing."
        >
          <MediaGallery
            items={content.heroMedia}
            onChange={(items) => onContentChange('heroMedia', items)}
          />
        </WizardCard>

        <WizardCard
          icon="Image"
          title="About Images"
          description="The two images shown in the About this Property section."
        >
          <SingleImageField
            label="Image 1"
            value={content.aboutImage1}
            onChange={(v) => onContentChange('aboutImage1', v)}
          />
          <SingleImageField
            label="Image 2"
            value={content.aboutImage2}
            onChange={(v) => onContentChange('aboutImage2', v)}
          />
        </WizardCard>

        <WizardCard
          icon="Video"
          title="Video & Virtual Tour"
          description="Optional links to a walkthrough video and a 360° tour."
        >
          <View className="gap-1.5">
            <Label>Video Link</Label>
            <Input
              value={content.videoLink}
              onChangeText={(t) => onContentChange('videoLink', t)}
              placeholder="Please enter link for video"
              autoCapitalize="none"
            />
          </View>
          <View className="gap-1.5">
            <Label>View 360</Label>
            <Input
              value={content.view360Link}
              onChangeText={(t) => onContentChange('view360Link', t)}
              placeholder="Please enter link for view 360"
              autoCapitalize="none"
            />
          </View>
        </WizardCard>

        {showDocuments ? (
          <WizardCard
            icon="FileText"
            title="Documents"
            description="Upload any supporting documents (title deed, evidence, contracts, etc.) — all optional."
          >
            <DocumentPickerField items={documents} onChange={onDocumentsChange} />
            {leadId !== undefined ? <IdentitySection leadId={leadId} /> : null}
            <View className="gap-1.5">
              <Label>Notes / Remarks</Label>
              <Textarea
                value={notes}
                onChangeText={onNotesChange}
                placeholder="Enter any additional notes here..."
                numberOfLines={2}
              />
            </View>
          </WizardCard>
        ) : null}
      </View>
    </ScrollView>
  );
}
