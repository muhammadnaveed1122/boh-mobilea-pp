import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import type { ProjectFaqSection } from '../../types';
import { SectionWrap } from './SectionWrap';

interface Props {
  faq: ProjectFaqSection | null;
}

function FaqItem({ q, a, isLast }: Readonly<{ q: string; a: string; isLast: boolean }>) {
  const [open, setOpen] = useState(false);
  return (
    <View className={isLast ? '' : 'border-b border-border'}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        className="flex-row items-center justify-between py-4"
      >
        <Text className="flex-1 pr-3 text-[15px] font-medium text-foreground">{q}</Text>
        <View
          className={`h-7 w-7 items-center justify-center rounded-full ${
            open ? 'bg-brand' : 'bg-muted'
          }`}
        >
          <Icon name={open ? 'Minus' : 'Plus'} size={14} color={open ? '#fff' : undefined} />
        </View>
      </Pressable>
      {open ? (
        <View className="pb-4 pr-10">
          <Text className="text-sm leading-6 text-muted-foreground">{a}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function FaqSection({ faq }: Readonly<Props>) {
  if (!faq || faq.items.length === 0) return null;
  return (
    <SectionWrap title="Frequently asked">
      <View className="rounded-2xl border border-border bg-card px-4">
        {faq.items.map((item, i) => (
          <FaqItem
            key={`${i}-${item.question}`}
            q={item.question}
            a={item.answer}
            isLast={i === faq.items.length - 1}
          />
        ))}
      </View>
    </SectionWrap>
  );
}
