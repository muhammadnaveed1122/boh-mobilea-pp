import { Image, View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { SectionWrap } from '@/features/new-projects/components/detail/SectionWrap';
import { isHttpUrl } from '../../utils/record';
import type { PropertyDetail } from '../../types';

export function PropertyTrakheesi({
  trakheesi,
}: Readonly<{ trakheesi: PropertyDetail['trakheesi'] }>) {
  if (!trakheesi || (!trakheesi.permitNumber && !isHttpUrl(trakheesi.qrCodeUrl))) return null;

  return (
    <SectionWrap title="DLD Permit">
      <View className="flex-row items-center gap-4 rounded-2xl border border-border bg-card p-4">
        {isHttpUrl(trakheesi.qrCodeUrl) ? (
          <Image
            source={{ uri: trakheesi.qrCodeUrl }}
            className="h-24 w-24 rounded-xl bg-muted"
            resizeMode="contain"
          />
        ) : null}
        <View className="flex-1">
          <Text className="text-xs uppercase tracking-wider text-muted-foreground">
            Trakheesi Permit
          </Text>
          {trakheesi.permitNumber ? (
            <Text className="mt-1 text-base font-semibold text-foreground">
              {trakheesi.permitNumber}
            </Text>
          ) : null}
        </View>
      </View>
    </SectionWrap>
  );
}
