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
  const digits = Math.abs(rounded).toString();

  let grouped = '';
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) {
      grouped += ',';
    }
    grouped += digits[i];
  }

  return sign + grouped;
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
