import { useMemo, useRef, useState } from 'react';
import RNIPhoneInput, {
  getCountryByCca2,
  type ICountry,
  type IPhoneInputRef,
  type PhoneInputProps as RNIPhoneInputProps,
} from 'rn-international-phone-number';
import { useTheme, useThemeColor } from '@theme';

type ICountryCca2 = NonNullable<RNIPhoneInputProps['defaultCountry']>;

export interface PhoneInputProps {
  value?: string;
  defaultCode?: string;
  onChangeFormattedText?: (text: string) => void;
  onBlur?: () => void;
  hasError?: boolean;
  placeholder?: string;
}

export function PhoneInput({
  value,
  defaultCode = 'AE',
  onChangeFormattedText,
  onBlur,
  hasError,
  placeholder = 'Phone number',
}: Readonly<PhoneInputProps>) {
  const ref = useRef<IPhoneInputRef>(null);

  const bg = useThemeColor('--background');
  const card = useThemeColor('--card');
  const border = useThemeColor(hasError ? '--destructive' : '--input');
  const borderToken = useThemeColor('--border');
  const fg = useThemeColor('--foreground');
  const mutedFg = useThemeColor('--muted-foreground');
  const primary = useThemeColor('--primary');
  const { colorScheme } = useTheme();

  const initialCountry = useMemo(() => getCountryByCca2(defaultCode) ?? null, [defaultCode]);
  const [country, setCountry] = useState<ICountry | null>(initialCountry);
  // Seed the national part from an E.164 `value` (edit prefill) by stripping the
  // country's calling-code root. Read once on mount — the field stays controlled
  // via onChange afterwards.
  const [national, setNational] = useState<string>(() => {
    if (!value) return '';
    const digits = value.replace(/\D/g, '');
    const rootDigits = (initialCountry?.idd?.root ?? '').replace(/\D/g, '');
    return rootDigits && digits.startsWith(rootDigits) ? digits.slice(rootDigits.length) : digits;
  });

  // Build the E.164 number from the fresh values directly instead of reading
  // ref.current?.getInternationalPhoneNumber(), whose closure still holds the
  // pre-update controlled `value` at microtask time and drops the last digit.
  function emit(nextNational: string, nextCountry: ICountry | null) {
    const digits = nextNational.replace(/\D/g, '');
    const root = nextCountry?.idd?.root ?? '';
    onChangeFormattedText?.(digits ? `${root}${digits}` : '');
  }

  return (
    <RNIPhoneInput
      ref={ref}
      defaultCountry={defaultCode as ICountryCca2}
      value={national}
      country={country}
      onChangePhoneNumber={(next) => {
        setNational(next);
        emit(next, country);
      }}
      onChangeCountry={(next) => {
        setCountry(next);
        emit(national, next);
      }}
      onBlur={onBlur}
      placeholder={placeholder}
      phoneInputPlaceholderTextColor={mutedFg}
      language="eng"
      theme={colorScheme === 'dark' ? 'dark' : 'light'}
      phoneInputStyles={{
        container: {
          width: '100%',
          height: 46,
          borderWidth: 1,
          borderRadius: 8,
          borderColor: border,
          backgroundColor: bg,
          overflow: 'hidden',
        },
        flagContainer: {
          backgroundColor: bg,
          paddingHorizontal: 10,
          borderTopLeftRadius: 7,
          borderBottomLeftRadius: 7,
        },
        divider: { backgroundColor: borderToken, marginHorizontal: 6 },
        caret: { color: mutedFg },
        callingCode: {
          fontSize: 14,
          fontWeight: '600',
          color: fg,
        },
        input: {
          fontSize: 14,
          color: fg,
        },
      }}
      modalSearchInputPlaceholderTextColor={mutedFg}
      modalSearchInputSelectionColor={primary}
      modalSearchInputFocusedBorderColor={primary}
      modalStyles={{
        backdrop: { backgroundColor: 'rgba(0,0,0,0.45)' },
        container: { backgroundColor: 'transparent' },
        content: { backgroundColor: card },
        dragHandleContainer: { backgroundColor: card },
        dragHandleIndicator: { backgroundColor: borderToken },
        closeButton: { backgroundColor: bg },
        closeButtonText: { color: fg },
        searchContainer: { backgroundColor: bg, borderColor: borderToken },
        searchInput: { color: fg, backgroundColor: bg, borderColor: borderToken },
        sectionTitle: { color: mutedFg, backgroundColor: card },
        list: { backgroundColor: card },
        countryItem: {
          backgroundColor: 'transparent',
          borderWidth: 0,
          borderBottomWidth: 1,
          borderBottomColor: borderToken,
          borderRadius: 0,
          marginBottom: 0,
        },
        flag: { color: fg },
        callingCode: { color: mutedFg },
        countryName: { color: fg },
        countryNotFoundContainer: { backgroundColor: card },
        countryNotFoundMessage: { color: mutedFg },
        alphabetContainer: { backgroundColor: card },
        alphabetLetterText: { color: mutedFg },
        alphabetLetterTextActive: { color: primary },
      }}
    />
  );
}
