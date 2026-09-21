/**
 * The one reusable dropdown. Feed it a catalog spec + the ctx it needs (or
 * an explicit `options` override for API-fed lists like City/Area). Renders
 * the existing `FieldSelect` atom. App-wide — no feature coupling.
 */

import { FieldSelect } from '@/components/molecules/dropdowns/property/FieldSelect';

import type { DropdownOption, DropdownSpec } from './types';
import { resolveOptions, resolvePlaceholder } from './types';

export interface DependentSelectProps<Ctx> {
  readonly spec: DropdownSpec<Ctx>;
  readonly ctx: Ctx;
  readonly value: string | undefined;
  readonly onChange: (value: string | undefined) => void;
  /** Override options (used for API-fed City/Area). */
  readonly options?: readonly DropdownOption[];
  readonly label?: string;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly error?: string;
  readonly portalHost?: string;
}

export function DependentSelect<Ctx>({
  spec,
  ctx,
  value,
  onChange,
  options,
  label,
  placeholder,
  disabled,
  readOnly,
  error,
  portalHost,
}: DependentSelectProps<Ctx>) {
  const resolved = options ?? resolveOptions(spec, ctx);
  const ph = placeholder ?? resolvePlaceholder(spec, ctx);

  return (
    <FieldSelect
      label={label ?? spec.label}
      placeholder={ph}
      options={resolved}
      value={value}
      onChange={onChange}
      disabled={disabled || resolved.length === 0}
      readOnly={readOnly}
      error={error}
      portalHost={portalHost}
    />
  );
}
