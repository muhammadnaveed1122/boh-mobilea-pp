import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFieldContext } from '../contexts';
import { FormBase, type FormBaseProps } from '../formbase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/atoms/Avatar';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';

export interface PickedImage {
  uri: string;
  name: string;
  mimeType: string;
}

type FormImagePickerProps = Omit<FormBaseProps, 'children' | 'controlFirst' | 'onPress'> & {
  fallbackInitials?: string;
  existingUrl?: string | null;
  size?: number;
};

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/svg+xml',
]);

export function FormImagePicker({
  label,
  required,
  fallbackInitials,
  existingUrl,
  size = 96,
}: Readonly<FormImagePickerProps>) {
  const field = useFieldContext<PickedImage | null>();
  const [busy, setBusy] = useState(false);

  async function pick() {
    setBusy(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Permission required',
          'Please allow photo library access to change your picture.',
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0]!;
      const mimeType = asset.mimeType ?? 'image/jpeg';
      if (!ALLOWED_MIME.has(mimeType)) {
        Alert.alert('Unsupported format', 'Pick a JPEG, PNG, WebP, or SVG image.');
        return;
      }
      field.handleChange({
        uri: asset.uri,
        name: asset.fileName ?? `profile.${mimeType.split('/')[1] ?? 'jpg'}`,
        mimeType,
      });
    } finally {
      setBusy(false);
    }
  }

  const previewUri = field.state.value?.uri ?? existingUrl ?? null;

  return (
    <FormBase label={label} required={required}>
      <View className="items-center">
        <Pressable
          onPress={pick}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Change profile picture"
          className="active:opacity-80"
        >
          <Avatar alt="Profile picture" style={{ width: size, height: size }}>
            {previewUri ? <AvatarImage source={{ uri: previewUri }} /> : null}
            <AvatarFallback textClassName="text-xl text-brand-foreground">
              <Text>{fallbackInitials ?? '?'}</Text>
            </AvatarFallback>
          </Avatar>
          <View
            className="absolute -bottom-1 -right-1 h-8 w-8 items-center justify-center rounded-full bg-primary"
            style={{ borderWidth: 2, borderColor: 'white' }}
          >
            <Icon name="Camera" size={16} color="white" />
          </View>
        </Pressable>
        <Text className="mt-2 text-xs text-muted-foreground">
          {busy ? 'Opening photo library…' : 'Tap to change'}
        </Text>
      </View>
    </FormBase>
  );
}
