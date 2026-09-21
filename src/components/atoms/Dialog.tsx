import { type ReactNode } from 'react';
import { Dimensions, Modal, Pressable, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useColorScheme, vars } from 'nativewind';
import { Text } from '@/components/atoms/Text';
import { tokens } from '@theme/tokens';

const themeVars = {
  light: vars(tokens.light),
  dark: vars(tokens.dark),
};

const MAX_DIALOG_HEIGHT = Dimensions.get('window').height * 0.85;

interface DialogProps {
  visible: boolean;
  onRequestClose?: () => void;
  title?: string;
  description?: string;
  children?: ReactNode;
  dismissOnBackdropPress?: boolean;
  scrollable?: boolean;
}

export function Dialog({
  visible,
  onRequestClose,
  title,
  description,
  children,
  dismissOnBackdropPress = true,
  scrollable = false,
}: Readonly<DialogProps>) {
  const { colorScheme } = useColorScheme();
  const scheme = colorScheme ?? 'light';

  const content = (
    <>
      {title ? <Text className="mb-2 text-xl font-bold text-foreground">{title}</Text> : null}
      {description ? (
        <Text className="mb-5 text-sm text-muted-foreground">{description}</Text>
      ) : null}
      {children}
    </>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
      statusBarTranslucent
    >
      <View style={[themeVars[scheme], { flex: 1 }]}>
        {scrollable ? (
          <Pressable
            onPress={dismissOnBackdropPress ? onRequestClose : undefined}
            className="flex-1 items-center justify-center bg-black/50 px-6"
          >
            <Pressable onPress={() => {}} className="w-full max-w-md">
              <View className="rounded-2xl bg-card" style={{ maxHeight: MAX_DIALOG_HEIGHT }}>
                <KeyboardAwareScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  contentContainerClassName="p-6"
                  bottomOffset={24}
                >
                  {content}
                </KeyboardAwareScrollView>
              </View>
            </Pressable>
          </Pressable>
        ) : (
          <Pressable
            onPress={dismissOnBackdropPress ? onRequestClose : undefined}
            className="flex-1 items-center justify-center bg-black/50 px-6"
          >
            <Pressable onPress={() => {}} className="w-full max-w-md">
              <View className="rounded-2xl bg-card p-6">{content}</View>
            </Pressable>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}
