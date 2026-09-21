/**
 * LeadProfileCard — profile-enrichment section of the Lead Details tab.
 *
 * Mirrors web `LeadProfileFields` (secondary phone, nationality, gender,
 * buyer type + payment method [buyer only], spoken languages). Edits ride the
 * page's shared Edit / Save action via `LeadFormContext.setField`, exactly like
 * the requirement cards.
 *
 * Mobile treatment: read mode renders compact `DetailRow`s (label left, value
 * right, N/A fallback); edit mode stacks full-width labelled controls so every
 * touch target clears 44pt and long option labels wrap instead of truncating.
 */

import { Fragment } from 'react';
import { View } from 'react-native';

import { MultiSelect } from '@/components/atoms/MultiSelect';
import { PhoneInput } from '@/components/atoms/PhoneInput';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  type SelectOption,
} from '@/components/atoms/Select';
import { Text } from '@/components/atoms/Text';

import { Persona } from '../../constants/lead-enums';
import {
  BUYER_TYPE_OPTIONS,
  GENDER_OPTIONS,
  NATIONALITY_LABEL_BY_CODE,
  NATIONALITY_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  SPOKEN_LANGUAGE_OPTIONS,
  normalizeSpokenLanguages,
} from '../../constants/lead-profile-fields';
import { useLeadFormContext } from '../../context/LeadFormContext';
import { leadToFormValues } from '../../form/model-adapter';
import { useLeadPermissions } from '../../hooks/use-lead-permissions';
import type { LeadDetail } from '../../models/lead-detail';

import { DetailRow } from './DetailRow';

const NA = 'N/A';

function labelFor(
  options: readonly SelectOption[] | typeof NATIONALITY_OPTIONS,
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  return (
    (options as { value: string; label: string }[]).find((o) => o?.value === value)?.label ?? value
  );
}

function NaText({ children }: Readonly<{ children: string | null | undefined }>) {
  if (!children) return <Text className="text-sm italic text-muted-foreground">{NA}</Text>;
  return <Text className="text-right text-sm font-semibold text-foreground">{children}</Text>;
}

interface EditFieldProps {
  label: string;
  children: React.ReactNode;
}

/** Full-width labelled control used in edit mode (stacked, touch-friendly). */
function EditField({ label, children }: Readonly<EditFieldProps>) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      {children}
    </View>
  );
}

interface OptionSelectProps {
  value: string | undefined;
  options: readonly SelectOption[];
  placeholder: string;
  onChange: (value: string | undefined) => void;
}

function OptionSelect({ value, options, placeholder, onChange }: Readonly<OptionSelectProps>) {
  const current = value ? options.find((o) => o?.value === value) : undefined;
  return (
    <Select value={current} onValueChange={(opt) => onChange(opt?.value)}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) =>
          o ? <SelectItem key={o.value} value={o.value} label={o.label} /> : null,
        )}
      </SelectContent>
    </Select>
  );
}

export interface LeadProfileCardProps {
  lead: LeadDetail;
}

export function LeadProfileCard({ lead }: Readonly<LeadProfileCardProps>) {
  const { canUpdate } = useLeadPermissions(lead);
  const { values, setField, isEditing } = useLeadFormContext();
  const editable = isEditing && canUpdate;

  const fv = leadToFormValues(values);
  const persona = fv.persona ?? (typeof lead.interest === 'string' ? lead.interest : undefined);
  const isBuyer = persona === (Persona.BUYER as string);

  const secondaryPhone = fv.secondaryPhone ?? '';
  const nationality = fv.nationality;
  const gender = fv.gender;
  const buyerType = fv.buyerType;
  const paymentMethod = fv.paymentMethod;
  const spokenLanguages = normalizeSpokenLanguages(fv.spokenLanguages);

  if (editable) {
    return (
      <View className="rounded-2xl bg-card p-4 shadow-sm">
        <Text className="text-base font-semibold text-brand">Profile</Text>
        <View className="mt-3 gap-4">
          <EditField label="Secondary Phone">
            <PhoneInput
              value={secondaryPhone}
              placeholder="Enter phone number"
              onChangeFormattedText={(text) => setField('secondaryPhone', text)}
            />
          </EditField>
          <EditField label="Nationality">
            <OptionSelect
              value={nationality}
              options={NATIONALITY_OPTIONS}
              placeholder="Select nationality"
              onChange={(v) => setField('nationality', v)}
            />
          </EditField>
          <EditField label="Gender">
            <OptionSelect
              value={gender}
              options={GENDER_OPTIONS}
              placeholder="Select gender"
              onChange={(v) => setField('gender', v)}
            />
          </EditField>
          {isBuyer ? (
            <Fragment>
              <EditField label="Buyer Type">
                <OptionSelect
                  value={buyerType}
                  options={BUYER_TYPE_OPTIONS}
                  placeholder="Select buyer type"
                  onChange={(v) => setField('buyerType', v)}
                />
              </EditField>
              <EditField label="Payment Method">
                <OptionSelect
                  value={paymentMethod}
                  options={PAYMENT_METHOD_OPTIONS}
                  placeholder="Select payment method"
                  onChange={(v) => setField('paymentMethod', v)}
                />
              </EditField>
            </Fragment>
          ) : null}
          <EditField label="Spoken Languages">
            <MultiSelect
              value={spokenLanguages}
              options={SPOKEN_LANGUAGE_OPTIONS}
              placeholder="Select spoken languages"
              onValueChange={(next) => setField('spokenLanguages', next)}
            />
          </EditField>
        </View>
      </View>
    );
  }

  const nationalityLabel = nationality
    ? (NATIONALITY_LABEL_BY_CODE.get(nationality) ?? nationality)
    : null;
  const languagesLabel = spokenLanguages.length > 0 ? spokenLanguages.join(', ') : null;

  return (
    <View className="rounded-2xl bg-card p-4 shadow-sm">
      <Text className="text-base font-semibold text-brand">Profile</Text>
      <View className="mt-3 overflow-hidden rounded-xl">
        <DetailRow label="Secondary Phone">
          <NaText>{secondaryPhone || null}</NaText>
        </DetailRow>
        <DetailRow label="Nationality">
          <NaText>{nationalityLabel}</NaText>
        </DetailRow>
        <DetailRow label="Gender">
          <NaText>{labelFor(GENDER_OPTIONS, gender)}</NaText>
        </DetailRow>
        {isBuyer ? (
          <Fragment>
            <DetailRow label="Buyer Type">
              <NaText>{labelFor(BUYER_TYPE_OPTIONS, buyerType)}</NaText>
            </DetailRow>
            <DetailRow label="Payment Method">
              <NaText>{labelFor(PAYMENT_METHOD_OPTIONS, paymentMethod)}</NaText>
            </DetailRow>
          </Fragment>
        ) : null}
        <DetailRow label="Spoken Languages" last>
          <NaText>{languagesLabel}</NaText>
        </DetailRow>
      </View>
    </View>
  );
}
