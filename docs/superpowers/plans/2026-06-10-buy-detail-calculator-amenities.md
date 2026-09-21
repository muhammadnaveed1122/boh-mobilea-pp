# Buy Detail Calculator + Project Amenities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Mortgage + ROI calculator and upgrade the amenities section (reuse the project `AmenitiesSection`) on the mobile buy property detail screen.

**Architecture:** Pure-RN tabbed calculator component seeded from `PropertyDetail.price`, with calculation math in a standalone util ported verbatim from the web. An adapter maps the buy `PropertyDetail.amenities` shape into the project `ProjectAmenitiesSection` shape so the richer project amenities carousel can be reused without editing it. Both wired into [PropertyDetailScreen.tsx](../../../src/features/properties/components/PropertyDetailScreen.tsx); both buy-project and opportunity kinds share that screen.

**Tech Stack:** React Native 0.81 / Expo SDK 54, NativeWind v4 (Tailwind tokens), TypeScript strict. No test runner — verify via `tsc --noEmit` + `pnpm lint` + manual QA (project convention: no unit tests).

---

## File Structure

New:

- `src/features/properties/components/detail/PropertyCalculator/calculations.ts` — pure math + formatters + defaults/constants.
- `src/features/properties/components/detail/PropertyCalculator/PropertyCalculator.tsx` — tabbed Mortgage/ROI UI.
- `src/features/properties/utils/to-project-amenities.ts` — adapter `PropertyDetail['amenities'] → ProjectAmenitiesSection | null`.

Modify:

- `src/features/properties/components/PropertyDetailScreen.tsx` — swap amenities component, insert calculator after Location.

No backend, type-source, or project-detail-screen changes. `PropertyAmenities.tsx` left in place (untouched).

---

## Task 1: Calculation util

**Files:**

- Create: `src/features/properties/components/detail/PropertyCalculator/calculations.ts`

- [ ] **Step 1: Write the util**

```ts
// Mortgage + ROI math, ported verbatim from the web listing calculators.
// Pure functions — no React, no side effects.

export const LOAN_PERIOD_OPTIONS = [5, 6, 7, 8, 9, 10, 11, 12, 15, 20, 25, 30] as const;

export const MORTGAGE_DEFAULTS = {
  downPaymentPercent: 20,
  interestRatePercent: 4,
  loanPeriodYears: 12,
} as const;

export const ROI_DEFAULTS = {
  dldFeePercent: 4,
  otherCosts: 1200,
  annualRent: 60000,
  annualServiceCharges: 1200,
  otherAnnualCosts: 2500,
} as const;

export interface MortgageInput {
  propertyValue: number;
  downPaymentPercent: number;
  loanPeriodYears: number;
  interestRatePercent: number;
}

export interface MortgageResult {
  downPaymentAmount: number;
  loanAmount: number;
  numberOfPayments: number;
  monthlyPayment: number;
  totalRepayment: number;
  totalInterest: number;
}

export function computeMortgage(input: MortgageInput): MortgageResult {
  const value = Math.max(0, input.propertyValue);
  const downPaymentAmount = value * (input.downPaymentPercent / 100);
  const loanAmount = Math.max(0, value - downPaymentAmount);
  const numberOfPayments = Math.max(0, Math.round(input.loanPeriodYears * 12));
  const r = input.interestRatePercent / 100 / 12;

  let monthlyPayment = 0;
  if (numberOfPayments > 0) {
    if (r > 0) {
      const factor = Math.pow(1 + r, numberOfPayments);
      monthlyPayment = (loanAmount * r * factor) / (factor - 1);
    } else {
      monthlyPayment = loanAmount / numberOfPayments;
    }
  }

  const totalRepayment = monthlyPayment * numberOfPayments;
  const totalInterest = totalRepayment - loanAmount;

  return {
    downPaymentAmount,
    loanAmount,
    numberOfPayments,
    monthlyPayment,
    totalRepayment,
    totalInterest,
  };
}

export interface RoiInput {
  propertyValue: number;
  dldFeePercent: number;
  otherCosts: number;
  annualRent: number;
  annualServiceCharges: number;
  otherAnnualCosts: number;
}

export interface RoiResult {
  oneTimeCosts: number;
  totalAcquisitionCost: number;
  totalCashInvested: number;
  opexAnnual: number;
  noi: number;
  grossYieldPercent: number;
  netYieldPercent: number;
  cashOnCashPercent: number;
}

export function computeRoi(input: RoiInput): RoiResult {
  const value = Math.max(0, input.propertyValue);
  const transferFee = (value * input.dldFeePercent) / 100;
  const oneTimeCosts = transferFee + input.otherCosts;
  const totalAcquisitionCost = value + oneTimeCosts;
  const opexAnnual = input.annualServiceCharges + input.otherAnnualCosts;
  const noi = input.annualRent - opexAnnual;

  return {
    oneTimeCosts,
    totalAcquisitionCost,
    totalCashInvested: totalAcquisitionCost,
    opexAnnual,
    noi,
    grossYieldPercent: value > 0 ? (input.annualRent / value) * 100 : 0,
    netYieldPercent: value > 0 ? (noi / value) * 100 : 0,
    cashOnCashPercent: totalAcquisitionCost > 0 ? (noi / totalAcquisitionCost) * 100 : 0,
  };
}

// ---------- formatting / parsing (Intl-free for Hermes safety) ----------

function withThousands(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? '-' : '';
  return (
    sign +
    Math.abs(rounded)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  );
}

export function formatAed(n: number): string {
  return `AED ${withThousands(n)}`;
}

export function formatPercent(n: number): string {
  return `${n.toFixed(2)}%`;
}

/** Strip non-numeric chars from user text and return a finite number (0 fallback). */
export function parseNumber(text: string): number {
  const cleaned = text.replace(/[^0-9.]/g, '');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors (the new file may be unreferenced yet — that is fine).

- [ ] **Step 3: Commit**

```bash
git add src/features/properties/components/detail/PropertyCalculator/calculations.ts
git commit -m "feat(properties): add mortgage + ROI calculation util"
```

---

## Task 2: Amenities adapter

**Files:**

- Create: `src/features/properties/utils/to-project-amenities.ts`

- [ ] **Step 1: Write the adapter**

```ts
import type { ProjectAmenitiesSection } from '@/features/new-projects/types';
import type { PropertyDetail } from '../types';

/**
 * Map the buy/opportunity `PropertyDetail.amenities` shape onto the richer
 * project `ProjectAmenitiesSection` so the project `AmenitiesSection` carousel
 * can be reused. Fields absent on the buy side get safe defaults; the project
 * component falls back to default slider images when an item has no media.
 */
export function toProjectAmenities(
  amenities: PropertyDetail['amenities'],
): ProjectAmenitiesSection | null {
  const items = amenities?.items ?? [];
  if (items.length === 0) return null;

  return {
    title: amenities?.title ?? null,
    tagline: amenities?.tagline ?? null,
    selectedCount: items.length,
    totalCount: items.length,
    items: items.map((item, idx) => ({
      id: item.id,
      amenityId: item.id,
      name: item.name,
      slug: item.slug,
      icon: item.icon ?? null,
      description: item.description ?? '',
      isCustom: false,
      isVisible: true,
      sortOrder: idx,
      media: item.media.map((m, mIdx) => ({
        id: `${item.id}-m${String(mIdx)}`,
        mediaUrl: m.url,
        mediaType: m.type,
        altText: m.altText ?? null,
        sortOrder: mIdx,
      })),
    })),
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors. (Confirms the produced object matches `ProjectAmenitiesSection` / `ProjectAmenityItem` / `ProjectMediaItem`.)

- [ ] **Step 3: Commit**

```bash
git add src/features/properties/utils/to-project-amenities.ts
git commit -m "feat(properties): adapter from PropertyDetail amenities to project shape"
```

---

## Task 3: PropertyCalculator component

**Files:**

- Create: `src/features/properties/components/detail/PropertyCalculator/PropertyCalculator.tsx`

Notes: no slider dependency exists, so down payment is a `%` input plus a derived/editable amount input with preset pills; loan period is selectable pills; interest rate is a `±0.5` stepper. Styling uses semantic NativeWind tokens (`bg-card`, `text-foreground`, `bg-primary`, etc.) per repo convention. Wrapped in the shared `SectionWrap` for visual parity with other detail sections.

- [ ] **Step 1: Write the component**

```tsx
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Text } from '@/components/atoms/Text';
import { SectionWrap } from '@/features/new-projects/components/detail/SectionWrap';
import { cn } from '@/lib/utils';
import {
  computeMortgage,
  computeRoi,
  formatAed,
  formatPercent,
  LOAN_PERIOD_OPTIONS,
  MORTGAGE_DEFAULTS,
  parseNumber,
  ROI_DEFAULTS,
} from './calculations';

type TabId = 'mortgage' | 'roi';

interface Props {
  price: number;
}

function LabeledInput({
  label,
  value,
  onChangeText,
  editable = true,
  keyboardType = 'numeric',
}: Readonly<{
  label: string;
  value: string;
  onChangeText?: (t: string) => void;
  editable?: boolean;
  keyboardType?: 'numeric' | 'decimal-pad';
}>) {
  return (
    <View className="mb-3">
      <Text className="mb-1 text-xs font-medium text-muted-foreground">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        keyboardType={keyboardType}
        className={cn(
          'rounded-xl border border-border px-3 py-2.5 text-base text-foreground',
          editable ? 'bg-background' : 'bg-muted',
        )}
      />
    </View>
  );
}

function ResultRow({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <View className="flex-row items-center justify-between border-b border-border py-2.5">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="text-sm font-semibold text-foreground">{value}</Text>
    </View>
  );
}

function Pill({
  label,
  active,
  onPress,
}: Readonly<{ label: string; active: boolean; onPress: () => void }>) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'rounded-full border px-3 py-1.5',
        active ? 'border-primary bg-primary' : 'border-border bg-background',
      )}
    >
      <Text className={cn('text-xs font-medium', active ? 'text-white' : 'text-foreground')}>
        {label}
      </Text>
    </Pressable>
  );
}

const DOWN_PAYMENT_PRESETS = [10, 20, 25, 50];

function MortgagePanel({ price }: Readonly<{ price: number }>) {
  const [propertyValue, setPropertyValue] = useState(String(Math.round(price)));
  const [downPaymentPercent, setDownPaymentPercent] = useState(
    String(MORTGAGE_DEFAULTS.downPaymentPercent),
  );
  const [loanPeriodYears, setLoanPeriodYears] = useState<number>(MORTGAGE_DEFAULTS.loanPeriodYears);
  const [interestRate, setInterestRate] = useState<number>(MORTGAGE_DEFAULTS.interestRatePercent);

  const value = parseNumber(propertyValue);
  const pct = parseNumber(downPaymentPercent);
  const downPaymentAmount = value * (pct / 100);

  const result = useMemo(
    () =>
      computeMortgage({
        propertyValue: value,
        downPaymentPercent: pct,
        loanPeriodYears,
        interestRatePercent: interestRate,
      }),
    [value, pct, loanPeriodYears, interestRate],
  );

  const onAmountChange = (text: string) => {
    const amount = parseNumber(text);
    setDownPaymentPercent(value > 0 ? String(Math.round((amount / value) * 10000) / 100) : '0');
  };

  return (
    <View>
      <LabeledInput
        label="Property Value (AED)"
        value={propertyValue}
        onChangeText={setPropertyValue}
      />

      <View className="flex-row gap-3">
        <View className="flex-1">
          <LabeledInput
            label="Down Payment (%)"
            value={downPaymentPercent}
            onChangeText={setDownPaymentPercent}
            keyboardType="decimal-pad"
          />
        </View>
        <View className="flex-1">
          <LabeledInput
            label="Down Payment (AED)"
            value={String(Math.round(downPaymentAmount))}
            onChangeText={onAmountChange}
          />
        </View>
      </View>

      <View className="mb-3 flex-row flex-wrap gap-2">
        {DOWN_PAYMENT_PRESETS.map((p) => (
          <Pill
            key={p}
            label={`${p}%`}
            active={pct === p}
            onPress={() => setDownPaymentPercent(String(p))}
          />
        ))}
      </View>

      <Text className="mb-1 text-xs font-medium text-muted-foreground">Loan Period (years)</Text>
      <View className="mb-3 flex-row flex-wrap gap-2">
        {LOAN_PERIOD_OPTIONS.map((y) => (
          <Pill
            key={y}
            label={String(y)}
            active={loanPeriodYears === y}
            onPress={() => setLoanPeriodYears(y)}
          />
        ))}
      </View>

      <Text className="mb-1 text-xs font-medium text-muted-foreground">Interest Rate (%)</Text>
      <View className="mb-4 flex-row items-center gap-3">
        <Pressable
          onPress={() => setInterestRate((r) => Math.max(0, Math.round((r - 0.5) * 100) / 100))}
          className="h-9 w-9 items-center justify-center rounded-full bg-muted"
        >
          <Text className="text-lg font-bold text-foreground">−</Text>
        </Pressable>
        <Text className="min-w-[56px] text-center text-base font-semibold text-foreground">
          {interestRate.toFixed(1)}%
        </Text>
        <Pressable
          onPress={() => setInterestRate((r) => Math.round((r + 0.5) * 100) / 100)}
          className="h-9 w-9 items-center justify-center rounded-full bg-muted"
        >
          <Text className="text-lg font-bold text-foreground">+</Text>
        </Pressable>
      </View>

      <View className="rounded-2xl bg-primary p-4">
        <Text className="text-xs text-white/80">Monthly Payment</Text>
        <Text className="mt-1 text-2xl font-bold text-white">
          {formatAed(result.monthlyPayment)}
        </Text>
      </View>

      <View className="mt-3 rounded-2xl bg-card p-4">
        <ResultRow label="No. of Payments" value={String(result.numberOfPayments)} />
        <ResultRow label="Loan Amount" value={formatAed(result.loanAmount)} />
        <ResultRow label="Total Interest Paid" value={formatAed(result.totalInterest)} />
        <ResultRow label="Property Price" value={formatAed(value)} />
        <ResultRow label="Total Repayment Amount" value={formatAed(result.totalRepayment)} />
      </View>
    </View>
  );
}

function RoiPanel({ price }: Readonly<{ price: number }>) {
  const [propertyValue, setPropertyValue] = useState(String(Math.round(price)));
  const [otherCosts, setOtherCosts] = useState(String(ROI_DEFAULTS.otherCosts));
  const [annualRent, setAnnualRent] = useState(String(ROI_DEFAULTS.annualRent));
  const [serviceCharges, setServiceCharges] = useState(String(ROI_DEFAULTS.annualServiceCharges));
  const [otherAnnual, setOtherAnnual] = useState(String(ROI_DEFAULTS.otherAnnualCosts));

  const value = parseNumber(propertyValue);

  const result = useMemo(
    () =>
      computeRoi({
        propertyValue: value,
        dldFeePercent: ROI_DEFAULTS.dldFeePercent,
        otherCosts: parseNumber(otherCosts),
        annualRent: parseNumber(annualRent),
        annualServiceCharges: parseNumber(serviceCharges),
        otherAnnualCosts: parseNumber(otherAnnual),
      }),
    [value, otherCosts, annualRent, serviceCharges, otherAnnual],
  );

  return (
    <View>
      <LabeledInput
        label="Property Value (AED)"
        value={propertyValue}
        onChangeText={setPropertyValue}
      />
      <LabeledInput
        label="DLD Fee"
        value={`${ROI_DEFAULTS.dldFeePercent}% (fixed)`}
        editable={false}
      />
      <LabeledInput label="Other Costs (AED)" value={otherCosts} onChangeText={setOtherCosts} />
      <LabeledInput label="Annual Rent (AED)" value={annualRent} onChangeText={setAnnualRent} />
      <LabeledInput
        label="Annual Service Charges (AED)"
        value={serviceCharges}
        onChangeText={setServiceCharges}
      />
      <LabeledInput
        label="Other Annual Costs (AED)"
        value={otherAnnual}
        onChangeText={setOtherAnnual}
      />

      <View className="mt-1 rounded-2xl bg-primary p-4">
        <Text className="text-xs text-white/80">Net Yield</Text>
        <Text className="mt-1 text-2xl font-bold text-white">
          {formatPercent(result.netYieldPercent)}
        </Text>
      </View>

      <View className="mt-3 rounded-2xl bg-card p-4">
        <ResultRow label="Gross Yield" value={formatPercent(result.grossYieldPercent)} />
        <ResultRow label="Cash-on-Cash Return" value={formatPercent(result.cashOnCashPercent)} />
        <ResultRow label="Net Operating Income" value={formatAed(result.noi)} />
        <ResultRow label="Annual OpEx" value={formatAed(result.opexAnnual)} />
        <ResultRow label="One-time Costs" value={formatAed(result.oneTimeCosts)} />
        <ResultRow label="Total Acquisition Cost" value={formatAed(result.totalAcquisitionCost)} />
        <ResultRow label="Total Cash Invested" value={formatAed(result.totalCashInvested)} />
      </View>
    </View>
  );
}

export function PropertyCalculator({ price }: Readonly<Props>) {
  const [tab, setTab] = useState<TabId>('mortgage');

  return (
    <SectionWrap title="Calculators" tagline="Estimate your mortgage and rental returns">
      <View className="mb-4 flex-row rounded-full bg-muted p-1">
        {(['mortgage', 'roi'] as const).map((id) => (
          <Pressable
            key={id}
            onPress={() => setTab(id)}
            className={cn(
              'flex-1 items-center rounded-full py-2',
              tab === id ? 'bg-primary' : 'bg-transparent',
            )}
          >
            <Text
              className={cn(
                'text-sm font-semibold',
                tab === id ? 'text-white' : 'text-muted-foreground',
              )}
            >
              {id === 'mortgage' ? 'Mortgage' : 'ROI'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'mortgage' ? <MortgagePanel price={price} /> : <RoiPanel price={price} />}
    </SectionWrap>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: no errors for the new file. (If sonarjs flags cognitive complexity > 20 on a panel, extract the offending block into a small helper component; do not disable the rule.)

- [ ] **Step 4: Commit**

```bash
git add src/features/properties/components/detail/PropertyCalculator/PropertyCalculator.tsx
git commit -m "feat(properties): mortgage + ROI calculator component"
```

---

## Task 4: Wire into PropertyDetailScreen

**Files:**

- Modify: `src/features/properties/components/PropertyDetailScreen.tsx`

- [ ] **Step 1: Swap imports**

Replace the line:

```tsx
import { PropertyAmenities } from './detail/PropertyAmenities';
```

with:

```tsx
import { AmenitiesSection } from '@/features/new-projects/components/detail/AmenitiesSection';
import { toProjectAmenities } from '../utils/to-project-amenities';
import { PropertyCalculator } from './detail/PropertyCalculator/PropertyCalculator';
```

- [ ] **Step 2: Swap the amenities render**

Replace:

```tsx
<PropertyAmenities amenities={data.amenities} />
```

with:

```tsx
<AmenitiesSection amenities={toProjectAmenities(data.amenities)} />
```

- [ ] **Step 3: Insert the calculator after Location**

Replace:

```tsx
        <PropertyLocation location={data.locationSection} />
        <PropertyTrakheesi trakheesi={data.trakheesi} />
```

with:

```tsx
        <PropertyLocation location={data.locationSection} />
        <PropertyCalculator price={data.price} />
        <PropertyTrakheesi trakheesi={data.trakheesi} />
```

- [ ] **Step 4: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Lint**

Run: `pnpm lint`
Expected: no errors. (`PropertyAmenities` import is now removed; ensure no unused-import lint error remains — the swap in Step 1 already drops it.)

- [ ] **Step 6: Commit**

```bash
git add src/features/properties/components/PropertyDetailScreen.tsx
git commit -m "feat(properties): use project amenities carousel + add calculator on buy detail"
```

---

## Task 5: Manual QA (no test runner)

- [ ] **Step 1: Run the app**

Run: `pnpm ios` (or `pnpm android`).

- [ ] **Step 2: Verify on a buy-project listing**

Open Home → Buy tab → tap a project listing. Confirm:

- Amenities section renders as the carousel/grid (tap an amenity → media preview modal opens; empty-media items show a default image).
- A "Calculators" section appears after Location.
- Mortgage tab: Property Value is pre-seeded from the listing price. Change down payment % → AED amount updates; change loan period pill and interest stepper → Monthly Payment and result rows recompute.
- ROI tab: switching tabs keeps Property Value seeded; editing rent/costs updates Net Yield + result rows.

- [ ] **Step 3: Verify on an opportunity listing**

Open Home → Buy tab → tap an opportunity listing (web equivalent `/buy-with-us/<slug>`). Repeat the Step 2 checks. Confirm amenities still render via the adapter and the calculator seeds price.

- [ ] **Step 4: Spot-check math vs web**

For one listing, plug the same inputs into the web calculator at `https://qa.rhkproperties.com/buy-with-us/<slug>` and confirm Monthly Payment and Net Yield match (allowing rounding).

- [ ] **Step 5: Edge case — missing price / no amenities**

Find or simulate a listing with `price = 0` (or no amenities). Confirm: calculator shows `AED 0` / `0.00%` with no crash/NaN; amenities section is hidden (adapter returns `null`).
