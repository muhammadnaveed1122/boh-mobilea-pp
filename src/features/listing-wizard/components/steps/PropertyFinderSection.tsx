import { Pressable, View } from 'react-native';

import { Checkbox } from '@/components/atoms/Checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/Select';
import { Text } from '@/components/atoms/Text';

import type { WizardPublish } from '../../portals.model';
import type { Opt } from '../../types';
import { LabeledInput } from './LabeledField';

/** Checkbox + label row. */
function CheckboxRow({
  label,
  checked,
  onChange,
}: Readonly<{ label: string; checked: boolean; onChange: (v: boolean) => void }>) {
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      className="flex-row items-center gap-2"
    >
      <Checkbox checked={checked} onCheckedChange={onChange} />
      <Text className="text-sm text-foreground">{label}</Text>
    </Pressable>
  );
}

/**
 * Property Finder config, shown when the PF portal toggle is on — agent picker, price
 * visibility, and a "save as draft on PF" flag. Mirrors the web Step5Publish PF block.
 */
export function PropertyFinderSection({
  publish,
  onChange,
  agents,
  agentsLoading,
}: Readonly<{
  publish: WizardPublish;
  onChange: (patch: Partial<WizardPublish>) => void;
  agents: Opt[];
  agentsLoading: boolean;
}>) {
  const current = publish.pfAgentId ? agents.find((a) => a.value === publish.pfAgentId) : undefined;

  return (
    <View className="gap-4 rounded-xl border border-border bg-background p-4">
      <View className="gap-1.5">
        <Text className="text-sm font-medium text-foreground">Property Finder Agent</Text>
        <Select
          value={current ? { value: current.value, label: current.label } : undefined}
          disabled={agentsLoading}
          onValueChange={(opt) => onChange({ pfAgentId: opt?.value ?? null })}
        >
          <SelectTrigger>
            <SelectValue
              className={current ? 'text-base text-foreground' : 'text-base text-muted-foreground'}
              placeholder={agentsLoading ? 'Loading agents…' : 'Select an agent'}
            />
          </SelectTrigger>
          <SelectContent>
            {agents.map((a) => (
              <SelectItem key={a.value} value={a.value} label={a.label} />
            ))}
          </SelectContent>
        </Select>
      </View>

      <CheckboxRow
        label="Hide price on Property Finder"
        checked={publish.pfPriceHidden}
        onChange={(v) => onChange({ pfPriceHidden: v })}
      />
      <CheckboxRow
        label="Save as draft on Property Finder"
        checked={publish.pfPublishAsDraft}
        onChange={(v) => onChange({ pfPublishAsDraft: v })}
      />
      <LabeledInput
        label="Property Finder Location ID"
        value={publish.pfLocationId ?? ''}
        onChangeText={(t) => onChange({ pfLocationId: t.trim() === '' ? null : t })}
        placeholder="e.g. 12345"
        keyboardType="numeric"
      />
    </View>
  );
}
