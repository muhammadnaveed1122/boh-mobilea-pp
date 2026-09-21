import { Image, View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { FavoriteHeartButton } from '@/features/favorites/components/FavoriteHeartButton';
import { FavoriteResourceKind } from '@/features/favorites/types';
import { statusLabel } from '../../utils/format';
import { useProjectCard } from './ProjectCardContext';

export function ProjectCardOverlay() {
  const { project } = useProjectCard();
  const status = statusLabel(project.availability);
  const logo = project.developer?.developer_logo;

  return (
    <>
      {logo ? (
        <View className="absolute left-3 top-3 h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white/95">
          <Image source={{ uri: logo }} className="h-full w-full" resizeMode="contain" />
        </View>
      ) : null}

      <FavoriteHeartButton
        kind={FavoriteResourceKind.PROJECT}
        id={project.projectId}
        className="absolute right-3 top-3"
      />

      {status ? (
        <View
          className="absolute bottom-3 left-3 flex-row items-center gap-1 rounded-full px-2.5 py-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
        >
          <View
            className={`h-1.5 w-1.5 rounded-full ${
              status === 'Ready' ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
          />
          <Text className="text-[11px] font-semibold text-white">{status}</Text>
        </View>
      ) : null}
    </>
  );
}
