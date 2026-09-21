import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Input } from '@/components/atoms/Input';
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
      <Input
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        keyboardType={keyboardType}
        className={cn('rounded-xl border-border', !editable && 'bg-muted')}
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
        active ? 'border-primary bg-primary' : 'border-border bg-muted',
      )}
    >
      <Text
        className={cn(
          'text-xs font-medium',
          active ? 'text-primary-foreground' : 'text-foreground',
        )}
      >
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
        <Text className="text-xs text-primary-foreground/80">Monthly Payment</Text>
        <Text className="mt-1 text-2xl font-bold text-primary-foreground">
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
        <Text className="text-xs text-primary-foreground/80">Net Yield</Text>
        <Text className="mt-1 text-2xl font-bold text-primary-foreground">
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
                tab === id ? 'text-primary-foreground' : 'text-muted-foreground',
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
