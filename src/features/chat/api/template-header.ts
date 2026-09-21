/**
 * Media-header detection for WhatsApp templates.
 *
 * A template like `property_listing` declares an IMAGE header component, and
 * Meta rejects the send outright (error 131008) if no media accompanies it.
 * Every send surface therefore has to know, before enabling its send button,
 * whether the chosen template needs a listing attached.
 *
 * The check is structural — it reads Meta's own `components` definition, the
 * same predicate the web client uses — rather than matching on the template
 * name. Any future media-header template is then handled automatically instead
 * of needing a new hardcoded name.
 *
 * `headerType` is a denormalised convenience column on the backend's template
 * row and is used only as a fallback, for the case where `components` is not
 * present on the payload.
 */

import type { ApiWhatsappTemplate } from './types';

export function requiresHeaderImage(template: ApiWhatsappTemplate | null): boolean {
  if (template === null) return false;

  const components = template.components;
  if (Array.isArray(components)) {
    return components.some(
      (c) => c?.type?.toUpperCase() === 'HEADER' && c?.format?.toUpperCase() === 'IMAGE',
    );
  }

  return template.headerType?.toUpperCase() === 'IMAGE';
}
