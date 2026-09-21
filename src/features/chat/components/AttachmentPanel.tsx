import type { ComponentType } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/atoms/Text';
import { useTheme, useThemeColorAlpha } from '@theme';

import { PANEL_BG_DARK, PANEL_BG_LIGHT } from './composer-colors';

import {
  capturePhotoOrVideo,
  isDocumentPickingAvailable,
  pickDocument,
  pickPhotoOrVideo,
} from '../media/pick-media';
import { isLocationPickingAvailable } from '../media/location';
import type { PickedAsset } from '../models/message';
import { CameraGlyph, DocumentGlyph, LocationGlyph, PhotosGlyph } from './AttachmentGlyphs';

interface Props {
  onPicked: (asset: PickedAsset) => void;
  onPickLocation?: () => void;
}

interface Tile {
  key: string;
  Glyph: ComponentType<{ size?: number }>;
  label: string;
  onPress: () => void;
}

function noop(): void {}

/**
 * WhatsApp-style attachment grid rendered inline BELOW the composer input row
 * (not a portaled sheet) so the composer rides on top of it and swapping
 * keyboard ↔ panel is seamless. The Composer owns the open/close state and the
 * panel height (matched to the keyboard).
 */
export function AttachmentPanel({ onPicked, onPickLocation }: Readonly<Props>) {
  // Theme-based tile circle: foreground @ 10% → subtle light disc on a dark
  // sheet, light-grey disc on a light sheet. Flips automatically with the theme.
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';
  const panelBg = isDark ? PANEL_BG_DARK : PANEL_BG_LIGHT;
  // White glyph discs on the light-grey panel; subtle light disc in dark mode.
  const darkCircle = useThemeColorAlpha('--foreground', 0.1);
  const circleBg = isDark ? darkCircle : '#FFFFFF';

  const runPick = (run: () => Promise<PickedAsset | null>) => (): void => {
    run()
      .then((asset) => {
        if (asset) onPicked(asset);
      })
      .catch(noop);
  };

  const tiles: Tile[] = [
    {
      key: 'photos',
      Glyph: PhotosGlyph,
      label: 'Photos',
      onPress: runPick(() => pickPhotoOrVideo(['images', 'videos'])),
    },
    { key: 'camera', Glyph: CameraGlyph, label: 'Camera', onPress: runPick(capturePhotoOrVideo) },
  ];

  if (onPickLocation && isLocationPickingAvailable()) {
    tiles.push({
      key: 'location',
      Glyph: LocationGlyph,
      label: 'Location',
      onPress: onPickLocation,
    });
  }

  if (isDocumentPickingAvailable()) {
    tiles.push({
      key: 'document',
      Glyph: DocumentGlyph,
      label: 'Document',
      onPress: runPick(pickDocument),
    });
  }

  return (
    <View className="flex-1 px-2 pt-4" style={{ backgroundColor: panelBg }}>
      <View className="flex-row flex-wrap">
        {tiles.map((t) => (
          <View key={t.key} className="w-1/4 items-center py-3">
            <Pressable
              onPress={t.onPress}
              accessibilityRole="button"
              accessibilityLabel={t.label}
              className="items-center active:opacity-70"
            >
              <View
                className="h-16 w-16 items-center justify-center rounded-full"
                style={{ backgroundColor: circleBg }}
              >
                <t.Glyph size={48} />
              </View>
              <Text className="mt-2 text-xs text-foreground">{t.label}</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}
